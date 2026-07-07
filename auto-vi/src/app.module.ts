import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
// import { TkCoreModule } from './tk-core';
import { TasksModule } from './tasks/tasks.module';
import { Task, TaskQueue, TaskAsset, Video } from './entities';
import { UploadModule } from './upload/upload.module';
import { AssetsModule } from './assets/assets.module';
// import { HealthModule } from './health/health.module';
import { TasksQueueModule } from './tasks-queue/tasks-queue.module';
import { VideosModule } from './videos/videos.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DATABASE_PATH ?? 'data/auto-ve.db',
      entities: [Task, TaskQueue, TaskAsset, Video],
      synchronize: process.env.NODE_ENV !== 'production',
      // WAL 模式允许读写并发；busy_timeout 让写操作在锁竞争时等待而非立即报 "database is locked"
      prepareDatabase: (db) => {
        db.pragma('journal_mode = WAL');
        db.pragma('busy_timeout = 10000');
        db.pragma('synchronous = NORMAL');
      },
    }),
    // TkCoreModule,
    TasksModule,
    UploadModule,
    AssetsModule,
    TasksQueueModule,
    VideosModule,
    // HealthModule,
  ],
})
export class AppModule {}
