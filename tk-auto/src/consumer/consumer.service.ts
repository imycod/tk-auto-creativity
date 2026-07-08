import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, join } from 'path';

import { BrowserService } from '../core/browser/browser.service';
import {
  clearCreativeStudioInputs,
  ensureChatboxExpanded,
  fillCreativeStudioPrompt,
  submitCreativeStudioPrompt,
  uploadImagesToCreativeStudio,
} from '../core/browser/creative-studio.helper';
import { RemoteTaskQueue } from './interface/remote-task-queue.dto';

const CREATIVE_STUDIO_URL = "https://ads.tiktok.com/creative/creativestudio/image-to-video"

@Injectable()
export class ConsumerService {
  private readonly logger = new Logger(ConsumerService.name);
  private isProcessing = false;
  private readonly maxBrowsers: number;
  private claimChain: Promise<unknown> = Promise.resolve();
  // auto-vi 内网服务基础地址
  private readonly autoViApiUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly browserService: BrowserService,
    private readonly configService: ConfigService,
  ) {
    this.autoViApiUrl = this.configService.get('AUTO_VI_API_URL') as string;
    const configured = Number(this.configService.get('MAX_BROWSERS'));
    this.maxBrowsers = Number.isFinite(configured) && configured > 0
      ? Math.min(configured, 5)
      : 5;
  }

  // 2分钟轮询一次
  @Interval(2 * 60 * 1000)
  async consumeQueue() {
    if (this.isProcessing) {
      // 防止重入：上一批未处理完时跳过本次轮询
      this.logger.warn('上一批任务仍在处理中，跳过本次轮询');
      return;
    }
    this.isProcessing = true;
    this.logger.log('开始轮询任务队列...');

    try {
      // 改用远端 auto-vi 服务查询任务队列
      const { data: response } = await firstValueFrom(this.httpService.post(`${this.autoViApiUrl}/api/tasks-queue/with-statuss`, {
        statuss: ['pending', 'retrying'],
      }));

      const pendingCount = response.data;

      if (pendingCount === 0) {
        this.logger.log('暂无待处理任务');
        return;
      }

      const workerCount = Math.min(this.maxBrowsers, pendingCount);
      this.logger.log(
        `获取到 ${pendingCount} 条待处理任务，启动 ${workerCount} 个浏览器并行消费`,
      );


      // 每个 worker 绑定一个浏览器 profile，循环领取并处理任务直到队列清空
      await Promise.all(
        Array.from({ length: workerCount }, (_, profileIndex) =>
          this.runWorker(profileIndex),
        ),
      );

    } catch (error) {
      this.logger.error(`轮询异常: ${(error as Error).message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async runWorker(profileIndex: number): Promise<void> {
    const workerId = `worker-${profileIndex}`;

    while (true) {
      const queueItem = await this.claimNextPendingTask(workerId);
      if (!queueItem) {
        break;
      }
      const ok = await this.processTask(queueItem, profileIndex);
      // 失败后不在同一轮询周期内立即重领（避免页面 UI 未恢复时连续 3 次失败）
      if (!ok) {
        break;
      }
    }
  }

  /**
     * 原子领取下一条待处理任务并标记为 processing。
     * 通过 claimChain 串行化，确保多个 worker 不会领取到同一条任务。
     */
  private claimNextPendingTask(workerId: string): Promise<RemoteTaskQueue | null> {
    const run = this.claimChain.then(() => this.doClaim(workerId));
    this.claimChain = run.catch(() => undefined);
    return run;
  }

  private async doClaim(workerId: string): Promise<RemoteTaskQueue | null> {
    const { data: response } = await firstValueFrom(this.httpService.post(`${this.autoViApiUrl}/api/tasks-queue/claim`, {
      workerId,
    }));

    return response.data as RemoteTaskQueue;
  }

  private async processTask(
    queueItem: RemoteTaskQueue,
    profileIndex: number,
  ): Promise<boolean> {
    const { queueId, taskId, task } = queueItem;

    // 执行浏览器自动化生成视频
    try {
      this.logger.log(
        `[worker-${profileIndex}] 开始处理任务 ${taskId}，prompt: ${task.promptText}`,
      );
      // 获取该任务的参考图（查看 assetType = 'image' 类型 asset）
      const imagePaths = task.assets
        ?.filter((a) => a.assetType === 'image')
        .map((a) => a.assetPath);

      await this.generateVideoWithBrowser(
        taskId,
        task.promptText,
        imagePaths,
        profileIndex,
      );

      // 提交成功：记录浏览器序号，状态置为 submitted，等待下载阶段按 promptText 匹配回收视频
      await firstValueFrom(this.httpService.patch(`${this.autoViApiUrl}/api/tasks-queue/${queueId}`, {
        status: 'submitted',
        stage: 'rendering',
        profileIndex,
      }));

      this.logger.log(
        `[worker-${profileIndex}] 任务 ${taskId} 已提交生成，等待下载`,
      );
      return true;
    } catch (error) {
      const message = (error as Error).message;
      const isFinalFailure = queueItem.retryCount >= 2;

      // 回写失败状态本身也可能出错；用独立 try/catch 兜住，
      // 避免回写异常向上冒泡变成「轮询异常」而中断整个 worker。
      try {
        await firstValueFrom(this.httpService.patch(`${this.autoViApiUrl}/api/tasks-queue/${queueId}`, {
          status: isFinalFailure ? 'failed' : 'retrying',
          stage: 'rendering',
          profileIndex,
          errorMessage: message,
          completedAt: new Date().toISOString(),
          retryCount: (queueItem.retryCount || 0) + 1,
        }));

        await firstValueFrom(this.httpService.post(`${this.autoViApiUrl}/api/tasks/update/${taskId}`, {
          status: isFinalFailure ? 'failed' : 'retrying',
        }));
      } catch (reportError) {
        this.logger.error(
          `[worker-${profileIndex}] 任务 ${taskId} 失败状态回写出错: ${(reportError as Error).message}`,
        );
      }

      this.logger.error(
        `[worker-${profileIndex}] 任务 ${taskId} 失败: ${message}`,
      );
      return false;
    }
  }


  private async generateVideoWithBrowser(
    taskId: number,
    promptText: string,
    imagePaths: string[] | undefined,
    profileIndex: number,
  ): Promise<void> {

    const page = await this.browserService.createPage({
      headless: false,
      profileIndex,
    });

    // 复用浏览器时，若不在目标页面才重新导航，避免重复加载拖慢速度
    if (!page.url().includes('/creative/creativestudio/image-to-video')) {
      await page.goto(this.configService.get<string>('CREATIVE_STUDIO_URL') ?? CREATIVE_STUDIO_URL);
      await page.waitForLoadState('networkidle');
    }

    await page.waitForSelector('fieldset[data-chatbox-part="container"]', {
      timeout: 15000,
    });

    // 复用标签页时页面可能在顶部，chatbox 折叠导致 Upload 不可见，先滚到底并展开
    await ensureChatboxExpanded(page);

    // 清空上一个任务残留的图片与提示词，再回填当前任务内容
    await clearCreativeStudioInputs(page);

    if (imagePaths?.length) {
      const localPaths = await this.resolveImagePaths(imagePaths, profileIndex);
      await uploadImagesToCreativeStudio(page, localPaths);
      this.logger.log(
        `[worker-${profileIndex}] 任务 ${taskId} 已上传 ${localPaths.length} 张图片`,
      );
    }

    if (promptText) {
      await fillCreativeStudioPrompt(page, promptText);
      this.logger.log(`[worker-${profileIndex}] 任务 ${taskId} 已填入提示词`);
    }

    await submitCreativeStudioPrompt(page);
    this.logger.log(`[worker-${profileIndex}] 任务 ${taskId} 已点击发送`);
  }

  /**
   * 把任务的参考图解析成 Playwright 可用的本地绝对路径。
   * 资产存的是 auto-vi 的 HTTP 地址，这里直接走 HTTP 下载到本地临时目录，
   * 不依赖 tk-auto 机器挂载 NAS 的 SMB 共享，避免「图片文件不存在 / 请求不到」。
   */
  private async resolveImagePaths(
    imagePaths: string[],
    profileIndex: number,
  ): Promise<string[]> {
    const tmpDir = join(
      process.cwd(),
      'data',
      'tmp-images',
      `profile-${profileIndex}`,
    );
    mkdirSync(tmpDir, { recursive: true });

    const localPaths: string[] = [];
    for (const raw of imagePaths) {
      // 已经是本地可访问的文件（含已挂载的 UNC 路径），直接用
      if (existsSync(raw)) {
        localPaths.push(raw);
        continue;
      }

      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        localPaths.push(await this.downloadImageToTmp(raw, tmpDir));
        continue;
      }

      throw new Error(`图片文件不存在或无法访问: ${raw}`);
    }

    return localPaths;
  }

  /** 通过 HTTP 下载图片到本地临时目录，返回保存后的绝对路径 */
  private async downloadImageToTmp(url: string, tmpDir: string): Promise<string> {
    const rawName =
      decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '') ||
      `img-${Date.now()}`;
    const dest = join(tmpDir, basename(rawName));

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<ArrayBuffer>(url, {
          responseType: 'arraybuffer',
        }),
      );
      writeFileSync(dest, Buffer.from(data));
      return dest;
    } catch (error) {
      throw new Error(
        `下载参考图失败: ${url} - ${(error as Error).message}`,
      );
    }
  }
}
