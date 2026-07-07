import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';

import { ConsumerModule } from './consumer/consumer.module';
import { DownloaderModule } from './downloader/downloader.module';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true, 
      envFilePath: ['.env', `.env.${process.env.NODE_ENV || 'development'}`] 
    }),
    HttpModule,
    ScheduleModule.forRoot(),
    ConsumerModule,
    DownloaderModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
