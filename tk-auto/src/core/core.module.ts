import { Module } from '@nestjs/common';
import { BrowserService } from './browser/browser.service';

@Module({
  providers: [BrowserService],
  exports: [BrowserService],
})
export class CoreModule { }