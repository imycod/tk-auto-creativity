import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { Browser, BrowserContext, chromium, Page } from 'playwright';

export interface BrowserSessionOptions {
  headless?: boolean;
  viewport?: { width: number; height: number };
  /** 复用已有标签页，避免每次新开窗口（默认 true） */
  reusePage?: boolean;
  /** 使用第几个浏览器配置（profile），用于并行启动多个浏览器（默认 0） */
  profileIndex?: number;
}

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserService.name);
  /** 每个 profileIndex 对应一个持久化浏览器上下文 */
  private readonly contexts = new Map<number, BrowserContext>();
  private readonly chromePath =
    process.env.BROWSER_EXECUTABLE_PATH ??
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  /** 多个 profile 的根目录，每个 profile 存在 browser-profiles/profile-<index> 下 */
  private readonly profilesRootDir =
    process.env.BROWSER_PROFILES_DIR ??
    join(process.cwd(), 'data', 'browser-profiles');

  // ========== 插件配置区 ==========
  // 单个插件路径
  private readonly extPaths: string[] = [
    resolve(process.cwd(), 'data', 'extensions/ZeroOmega_3.4.5'),
  ];

  /** 取得某个 profile 的用户数据目录 */
  private profileDir(profileIndex: number): string {
    return join(this.profilesRootDir, `profile-${profileIndex}`);
  }

  /**
   * 使用本地 Chrome + 持久化用户目录，登录态和 Cookie 会保留。
   * 每个 profileIndex 拥有独立的用户目录，可同时启动多个互不影响的浏览器。
   * 手动关闭浏览器后，下次调用会自动重新启动。
   */
  async getContext(
    options: BrowserSessionOptions = {},
  ): Promise<BrowserContext> {
    const profileIndex = options.profileIndex ?? 0;

    const existing = this.contexts.get(profileIndex);
    if (existing && (existing.browser()?.isConnected() ?? false)) {
      return existing;
    }
    this.contexts.delete(profileIndex);

    const userDataDir = this.profileDir(profileIndex);
    mkdirSync(userDataDir, { recursive: true });

    // 组装浏览器启动参数
    const launchArgs = ['--disable-blink-features=AutomationControlled'];

    // 追加扩展加载参数（仅当存在扩展目录时）
    if (this.extPaths.length > 0) {
      const validPaths = this.extPaths.filter((p) => p);
      // 允许加载的扩展列表逗号拼接
      const allowExts = validPaths.join(',');
      launchArgs.push(`--disable-extensions-except=${allowExts}`);
      // 逐个加载每个扩展
      validPaths.forEach((path) => {
        launchArgs.push(`--load-extension=${path}`);
      });
    }

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: options.headless ?? false,
      executablePath: this.chromePath,
      viewport: options.viewport ?? { width: 1280, height: 720 },
      args: launchArgs,
    });

    context.on('close', () => {
      this.logger.log(
        `浏览器窗口已关闭（profile-${profileIndex}），下次调用将自动重新启动`,
      );
      if (this.contexts.get(profileIndex) === context) {
        this.contexts.delete(profileIndex);
      }
    });

    this.contexts.set(profileIndex, context);
    this.logger.log(`本地 Chrome 已启动（profile: ${userDataDir}）`);
    return context;
  }

  async getBrowser(options: BrowserSessionOptions = {}): Promise<Browser> {
    const context = await this.getContext(options);
    const browser = context.browser();
    if (!browser) {
      throw new Error('Persistent context has no browser instance');
    }
    return browser;
  }

  async createContext(
    options: BrowserSessionOptions = {},
  ): Promise<BrowserContext> {
    return this.getContext(options);
  }

  async createPage(options: BrowserSessionOptions = {}): Promise<Page> {
    try {
      return await this.createPageInternal(options);
    } catch (error) {
      if (!this.isClosedError(error)) {
        throw error;
      }
      this.logger.warn('检测到浏览器已关闭，正在重新启动...');
      this.contexts.delete(options.profileIndex ?? 0);
      return this.createPageInternal(options);
    }
  }

  async onModuleDestroy(): Promise<void> {
    const contexts = [...this.contexts.values()];
    this.contexts.clear();
    await Promise.all(
      contexts.map((ctx) => ctx.close().catch(() => undefined)),
    );
    if (contexts.length > 0) {
      this.logger.log('本地 Chrome 已全部关闭');
    }
  }

  private async createPageInternal(
    options: BrowserSessionOptions,
  ): Promise<Page> {
    const context = await this.getContext(options);
    const reusePage = options.reusePage ?? true;

    if (reusePage) {
      const existing = context.pages().find((p) => !p.isClosed());
      if (existing) {
        this.logger.debug('复用已有标签页');
        return existing;
      }
    }

    return context.newPage();
  }

  private isClosedError(error: unknown): boolean {
    const message = (error as Error)?.message ?? '';
    return message.includes('has been closed');
  }
}
