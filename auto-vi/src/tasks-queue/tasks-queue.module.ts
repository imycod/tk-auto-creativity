import { Module } from '@nestjs/common';
import { TasksQueueService } from './tasks-queue.service';
import { TasksQueueController } from './tasks-queue.controller';
import { Task } from 'src/entities/task.entity';
import { TaskQueue } from 'src/entities/task-queue.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskQueue]),
  ],
  controllers: [TasksQueueController],
  providers: [TasksQueueService],
})
export class TasksQueueModule {}
