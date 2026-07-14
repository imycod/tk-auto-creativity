import { Injectable, Logger } from '@nestjs/common';
import type { Page } from 'playwright';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { join, win32 } from 'path';
import { existsSync, mkdirSync } from 'fs';
import {
  closeDownloadsManager,
  DownloadFailedError,
  downloadVideoByPrompt,
  GenerationFailedError,
} from '../core/browser/creative-studio.helper';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { TaskQueue } from 'src/interface/task-queue';
import { BrowserService } from '../core/browser/browser.service';

const CREATIVE_STUDIO_URL =
  'https://ads.tiktok.com/creative/creativestudio/image-to-video';

@Injectable()
export class DownloaderService {
  private readonly logger = new Logger(DownloaderService.name);

  private isDownloading = false;
  /** 视频保存目录 */
  private readonly downloadDir: string;
  private readonly autoViApiUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly browserService: BrowserService,
  ) {

    this.autoViApiUrl = this.configService.get('AUTO_VI_API_URL') as string;
    const rawShare = this.configService.get('SAMBA_SHARE');
    this.downloadDir = rawShare ? win32.join(rawShare, 'AI素材', 'tk-auto')
      : join(process.cwd(), 'data', 'videos');

    // 仅尝试创建，不让网络共享暂不可达导致整个服务启动失败；真正下载时还会再确保一次
    this.ensureDownloadDir();
  }

  /**
   * 确保下载目录存在。失败（如 SMB 共享暂未挂载 / UNC 路径递归创建报 UNKNOWN）只记录告警，
   * 不抛出，避免在构造阶段中断依赖注入、拖垮整个应用启动。
   */
  private ensureDownloadDir(): boolean {
    try {
      if (existsSync(this.downloadDir)) {
        return true;
      }

      // Windows UNC 路径上 recursive mkdir 可能报 UNKNOWN，改为逐级创建
      if (this.downloadDir.startsWith('\\\\')) {
        this.mkdirUncStepByStep(this.downloadDir);
        return true;
      }

      mkdirSync(this.downloadDir, { recursive: true });
      return true;
    } catch (error) {
      this.logger.warn(
        `下载目录暂不可用（下载时将重试）: ${this.downloadDir} - ${(error as Error).message}`,
      );
      return false;
    }
  }

  /** 逐级创建 UNC 目录，避免 Node recursive mkdir 在 SMB 上报 UNKNOWN */
  private mkdirUncStepByStep(uncPath: string): void {
    const segments = uncPath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .split('/')
      .filter(Boolean);

    if (segments.length < 2) {
      throw new Error(`无效的 UNC 路径: ${uncPath}`);
    }

    let current = win32.join('\\\\', segments[0]);
    for (let i = 1; i < segments.length; i += 1) {
      current = win32.join(current, segments[i]);
      if (!existsSync(current)) {
        mkdirSync(current);
      }
    }
  }

  // 10 min 轮询一次（自动下载） 10 * 60 * 1000
  @Interval(10 * 60 * 1000)
  async pollDownloads() {
    if (this.isDownloading) {
      this.logger.warn('上一轮下载仍在进行，跳过本次');
      return;
    }
    this.isDownloading = true;

    try {

      const { data: response } = await firstValueFrom(this.httpService.post(`${this.autoViApiUrl}/api/tasks-queue/submitted`));

      const submitted = response.data;

      if (submitted.length === 0) {
        this.logger.log('暂无待下载任务');
        return;
      }

      // 按浏览器 profile 分组，不同浏览器并行下载
      const byProfile = new Map<number, TaskQueue[]>();
      for (const item of submitted) {
        const profileIndex = item.profileIndex ?? 0;
        const list = byProfile.get(profileIndex) ?? [];
        list.push(item);
        byProfile.set(profileIndex, list);
      }

      this.logger.log(
        `发现 ${submitted.length} 条待下载任务，涉及 ${byProfile.size} 个浏览器`,
      );

      await Promise.all(
        [...byProfile.entries()].map(([profileIndex, items]) =>
          this.downloadForProfile(profileIndex, items),
        ),
      );

    } catch (error) {
      this.logger.error(`下载异常: ${(error as Error).message}`);

    } finally {
      this.isDownloading = false;
    }
  }

  /** 在指定浏览器中逐个下载该 profile 的待回收视频（按 promptText 在页面上匹配定位） */
  private async downloadForProfile(
    profileIndex: number,
    items: TaskQueue[],
  ): Promise<void> {
    let page: Page;
    try {
      page = await this.getDownloadPage(profileIndex);
    } catch (error) {
      this.logger.error(
        `[downloader-${profileIndex}] 打开下载页面失败: ${(error as Error).message}`,
      );
      return;
    }

    for (const item of items) {
      await this.downloadOne(page, profileIndex, item);
    }
  }

  private async downloadOne(
    page: Page,
    profileIndex: number,
    item: TaskQueue,
  ): Promise<void> {

    const { queueId, taskId, task } = item;
    const promptText = task?.promptText;
    if (!promptText) {
      this.logger.warn(
        `[downloader-${profileIndex}] 任务 ${taskId} 缺少 promptText，无法匹配页面视频块，跳过`,
      );
      return;
    }

    if (!this.ensureDownloadDir()) {
      this.logger.warn(
        `[downloader-${profileIndex}] 任务 ${taskId} 跳过：下载目录不可用 ${this.downloadDir}`,
      );
      return;
    }

    try {
      const savePath = win32.join(this.downloadDir, `task_${taskId}.mp4`);
      const result = await downloadVideoByPrompt(page, promptText, savePath);
      if (!result) {
        this.logger.log(
          `[downloader-${profileIndex}] 任务 ${taskId} 对应视频块未找到或尚未生成完成，稍后重试`,
        );
        return;
      }

      // 浏览器侧已下载到本地，回写 auto-vi（按 taskId upsert，避免误用 videoId 导致 404）
      await firstValueFrom(
        this.httpService.patch(`${this.autoViApiUrl}/api/videos/by-task/${taskId}`, {
          filePath: result.filePath,
          promptText: result.promptText,
        }),
      );
      await firstValueFrom(this.httpService.patch(`${this.autoViApiUrl}/api/tasks-queue/${queueId}`, {
        status: 'completed',
        stage: 'postprocess',
        completedAt: new Date(),
      }));

      await firstValueFrom(this.httpService.post(`${this.autoViApiUrl}/api/tasks/update/${taskId}`, {
        status: 'completed',
      }));

      this.logger.log(
        `[downloader-${profileIndex}] 任务 ${taskId} 下载完成: ${result.filePath}`,
      );
    } catch (error) {
      const message = (error as Error).message;
      const shouldReportFailure =
        error instanceof DownloadFailedError ||
        error instanceof GenerationFailedError;

      if (shouldReportFailure) {
        try {
          await firstValueFrom(this.httpService.patch(`${this.autoViApiUrl}/api/tasks-queue/${queueId}`, {
            status: 'failed',
            stage: 'postprocess',
            errorMessage: message,
            completedAt: new Date().toISOString(),
          }));
          await firstValueFrom(this.httpService.post(`${this.autoViApiUrl}/api/tasks/update/${taskId}`, {
            status: 'failed',
          }));
        } catch (reportError) {
          this.logger.error(
            `[downloader-${profileIndex}] 任务 ${taskId} 错误回写失败: ${(reportError as Error).message}`,
          );
        }

        if (error instanceof DownloadFailedError) {
          await closeDownloadsManager(page).catch((closeError) => {
            this.logger.warn(
              `[downloader-${profileIndex}] 关闭 Downloads 悬浮窗失败: ${(closeError as Error).message}`,
            );
          });
        }
      }

      const kind =
        error instanceof GenerationFailedError ? '生成失败' : '下载失败';
      this.logger.error(
        `[downloader-${profileIndex}] 任务 ${taskId} ${kind}: ${message}`,
      );
    }

  }

  /**
 * 复用生成阶段已经打开的浏览器标签页（reusePage 默认 true），不再新开浏览器/标签页。
 * Creative Studio 是 SPA，新生成的视频会实时出现在列表里，无需刷新。
 */
  private async getDownloadPage(profileIndex: number): Promise<Page> {
    const page = await this.browserService.createPage({
      headless: false,
      profileIndex,
    });
    await this.ensureOnStudioPage(page);
    return page;
  }


  private async ensureOnStudioPage(page: Page): Promise<void> {
    const url =
      this.configService.get<string>('CREATIVE_STUDIO_URL') ??
      CREATIVE_STUDIO_URL;
    // 仅当不在目标页面时才导航，避免打断生成阶段或频繁刷新
    if (!page.url().includes('/creative/creativestudio/image-to-video')) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
    }
  }

}
