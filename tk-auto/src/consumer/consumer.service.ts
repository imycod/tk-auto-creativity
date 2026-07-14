import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, join } from 'path';

import { BrowserService } from '../core/browser/browser.service';
import {
  assertEnoughCreditsForDuration,
  clearCreativeStudioInputs,
  DownloadsManagerFailure,
  ensureChatboxExpanded,
  fillCreativeStudioPrompt,
  InsufficientCreditsError,
  promptMatches,
  setCreativeStudioDuration,
  submitCreativeStudioPrompt,
  uploadImagesToCreativeStudio,
} from '../core/browser/creative-studio.helper';
import { RemoteTaskQueue } from './interface/remote-task-queue.dto';

const CREATIVE_STUDIO_URL = "https://ads.tiktok.com/creative/creativestudio/image-to-video"
const SUBMIT_SLOT_FULL = 'SUBMIT_SLOT_FULL';

@Injectable()
export class ConsumerService {
  private readonly logger = new Logger(ConsumerService.name);
  private isProcessing = false;
  private readonly maxBrowsers: number;
  private claimChain: Promise<unknown> = Promise.resolve();
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

  @Interval(2 * 60 * 1000)
  async consumeQueue() {
    if (this.isProcessing) {
      this.logger.warn('上一批任务仍在处理中，跳过本次轮询');
      return;
    }
    this.isProcessing = true;
    this.logger.log('开始轮询任务队列...');

    try {
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
      const queueItem = await this.claimNextPendingTask(workerId, profileIndex);
      if (!queueItem) {
        break;
      }
      const ok = await this.processTask(queueItem, profileIndex);
      if (!ok) {
        break;
      }
    }
  }

  private claimNextPendingTask(
    workerId: string,
    profileIndex: number,
  ): Promise<RemoteTaskQueue | null> {
    const run = this.claimChain.then(() => this.doClaim(workerId, profileIndex));
    this.claimChain = run.catch(() => undefined);
    return run;
  }

  private async doClaim(
    workerId: string,
    profileIndex: number,
  ): Promise<RemoteTaskQueue | null> {
    const { data: response } = await firstValueFrom(this.httpService.post(`${this.autoViApiUrl}/api/tasks-queue/claim`, {
      workerId,
      profileIndex,
    }));

    return response.data as RemoteTaskQueue;
  }

  private async processTask(
    queueItem: RemoteTaskQueue,
    profileIndex: number,
  ): Promise<boolean> {
    const { queueId, taskId, task } = queueItem;

    try {
      this.logger.log(
        `[worker-${profileIndex}] 开始处理任务 ${taskId}，prompt: ${task.promptText}`,
      );
      const imagePaths = task.assets
        ?.filter((a) => a.assetType === 'image')
        .map((a) => a.assetPath);

      await this.generateVideoWithBrowser(
        taskId,
        task.promptText,
        imagePaths,
        profileIndex,
        task.duration,
      );

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

      if (message.includes(SUBMIT_SLOT_FULL)) {
        try {
          await firstValueFrom(this.httpService.patch(`${this.autoViApiUrl}/api/tasks-queue/${queueId}`, {
            status: 'pending',
            stage: 'init',
            workerId: null,
            profileIndex: null,
            errorMessage: '浏览器并发已满，等待槽位释放后重试',
          }));

          await firstValueFrom(this.httpService.post(`${this.autoViApiUrl}/api/tasks/update/${taskId}`, {
            status: 'pending',
          }));
        } catch (reportError) {
          this.logger.error(
            `[worker-${profileIndex}] 任务 ${taskId} 槽位满退回失败: ${(reportError as Error).message}`,
          );
        }

        this.logger.warn(
          `[worker-${profileIndex}] 任务 ${taskId} 浏览器并发已满，已退回队列等待槽位`,
        );
        return false;
      }

      // 积分不足：直接失败写入 errorMessage，重试无意义
      if (error instanceof InsufficientCreditsError) {
        try {
          await firstValueFrom(this.httpService.patch(`${this.autoViApiUrl}/api/tasks-queue/${queueId}`, {
            status: 'failed',
            stage: 'rendering',
            profileIndex,
            errorMessage: message,
            completedAt: new Date().toISOString(),
          }));
          await firstValueFrom(this.httpService.post(`${this.autoViApiUrl}/api/tasks/update/${taskId}`, {
            status: 'failed',
          }));
        } catch (reportError) {
          this.logger.error(
            `[worker-${profileIndex}] 任务 ${taskId} 积分不足回写失败: ${(reportError as Error).message}`,
          );
        }
        this.logger.error(
          `[worker-${profileIndex}] 任务 ${taskId} ${message}`,
        );
        return false;
      }

      const isFinalFailure = queueItem.retryCount >= 2;

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
          `[worker-${profileIndex}] 任务 ${taskId} 失败状态回写失败: ${(reportError as Error).message}`,
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
    duration?: number,
  ): Promise<void> {

    const page = await this.browserService.createPage({
      headless: false,
      profileIndex,
    });

    if (!page.url().includes('/creative/creativestudio/image-to-video')) {
      await page.goto(this.configService.get<string>('CREATIVE_STUDIO_URL') ?? CREATIVE_STUDIO_URL);
      await page.waitForLoadState('networkidle');
    }

    await page.waitForSelector('fieldset[data-chatbox-part="container"]', {
      timeout: 15000,
    });

    await ensureChatboxExpanded(page);
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

    const durationSeconds = duration ?? 15;
    await setCreativeStudioDuration(page, durationSeconds);
    this.logger.log(
      `[worker-${profileIndex}] 任务 ${taskId} 已设置视频时长 ${durationSeconds}s`,
    );

    const credits = await assertEnoughCreditsForDuration(page, durationSeconds);
  
    this.logger.log(
      `[worker-${profileIndex}] 任务 ${taskId} 积分校验通过：当前 ${credits}`,
    );

    // 提交前：写回 Downloads 失败 → 关闭悬浮窗 → 再点发送
    await submitCreativeStudioPrompt(page, (failures) =>
      this.reportDownloadsManagerFailures(failures, profileIndex),
    );
    this.logger.log(`[worker-${profileIndex}] 任务 ${taskId} 已点击发送`);
  }

  /**
   * 将 Downloads 悬浮窗失败项按 title≈promptText 关联到 submitted 队列任务并写回 errorMessage。
   */
  private async reportDownloadsManagerFailures(
    failures: DownloadsManagerFailure[],
    profileIndex: number,
  ): Promise<void> {
    try {
      const { data: response } = await firstValueFrom(
        this.httpService.post(`${this.autoViApiUrl}/api/tasks-queue/submitted`),
      );
      const submitted = (response.data ?? []) as Array<{
        queueId: number;
        taskId: number;
        profileIndex?: number;
        task?: { promptText?: string };
      }>;

      const candidates = submitted.filter(
        (item) => (item.profileIndex ?? 0) === profileIndex,
      );

      for (const failure of failures) {
        const message = `${failure.title}: ${failure.status}`;
        const matched = candidates.find((item) =>
          promptMatches(failure.title, item.task?.promptText ?? ''),
        );

        if (!matched) {
          this.logger.warn(
            `[worker-${profileIndex}] Downloads 失败未匹配到任务: ${message}`,
          );
          continue;
        }

        await firstValueFrom(
          this.httpService.patch(
            `${this.autoViApiUrl}/api/tasks-queue/${matched.queueId}`,
            {
              status: 'failed',
              stage: 'postprocess',
              errorMessage: message,
              completedAt: new Date().toISOString(),
            },
          ),
        );
        await firstValueFrom(
          this.httpService.post(
            `${this.autoViApiUrl}/api/tasks/update/${matched.taskId}`,
            { status: 'failed' },
          ),
        );
        this.logger.error(
          `[worker-${profileIndex}] 任务 ${matched.taskId} 下载失败已回写: ${message}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[worker-${profileIndex}] Downloads 失败回写异常: ${(error as Error).message}`,
      );
    }
  }

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
