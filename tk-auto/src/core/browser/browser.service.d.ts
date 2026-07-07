import { OnModuleDestroy } from '@nestjs/common';
import { Browser, BrowserContext, Page } from 'playwright';
export interface BrowserSessionOptions {
    headless?: boolean;
    viewport?: {
        width: number;
        height: number;
    };
}
export declare class BrowserService implements OnModuleDestroy {
    private readonly logger;
    private browser;
    getBrowser(options?: BrowserSessionOptions): Promise<Browser>;
    createContext(options?: BrowserSessionOptions): Promise<BrowserContext>;
    createPage(options?: BrowserSessionOptions): Promise<Page>;
    onModuleDestroy(): Promise<void>;
}
