import { Module } from '@nestjs/common';
import { DownloaderService } from './downloader.service';
import { HttpModule } from '@nestjs/axios';
import { CoreModule } from '../core/core.module';

@Module({
  imports: [
    HttpModule, 
    CoreModule,
  ],
  controllers: [],
  providers: [DownloaderService],
})
export class DownloaderModule {}
