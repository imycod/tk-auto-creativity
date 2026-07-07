import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// import { TkCoreModule } from '../tk-core';
import { Task, TaskQueue, Video } from '../entities';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
// import { VideoQueueConsumer } from './queue.consumer';
// import { VideoDownloader } from './video.downloader';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskQueue, Video]),
    // TkCoreModule,
  ],
  controllers: [TasksController],
  providers: [
    TasksService, 
    // VideoQueueConsumer, 
    // VideoDownloader
  ],
  exports: [TasksService],
})
export class TasksModule {}
