import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { TasksQueueService } from './tasks-queue.service';
import { UpdateTaskQueueDto } from './dto/update-task-queue.dto';
import { FindAllTaskQueueDto } from './dto/find-all-task-queue.dto';
import { ApiResponse } from 'src/common/decorators/api-response.decorator';
import { FindWithStatussDto } from './dto/find-with-statuss.dto';
import { TaskQueue } from 'src/entities/task-queue.entity';

@Controller('tasks-queue')
export class TasksQueueController {
  constructor(private readonly tasksQueueService: TasksQueueService) {}

  @Post()
  @ApiResponse('获取任务队列列表成功')
  findAll(@Body() dto: FindAllTaskQueueDto) {
    return this.tasksQueueService.findAll(dto);
  }

  @Patch(':queueId')
  @ApiResponse('更新任务队列成功')
  update(@Param('queueId', ParseIntPipe) queueId: number, @Body() updateTaskQueueDto: UpdateTaskQueueDto) {
    return this.tasksQueueService.update(queueId, updateTaskQueueDto);
  }

  @Post('with-statuss')
  @ApiResponse('获取任务队列状态数量成功')
  findWithStatuss(@Body() dto: FindWithStatussDto): Promise<number> {
    return this.tasksQueueService.findWithStatuss(dto.statuss ?? []);
  } 

  @Post('claim')
  @ApiResponse('领取任务队列成功')
  findQueueClaim(@Body('workerId') workerId: string) {
    return this.tasksQueueService.findQueueClaim(workerId);
  }

  @Post('submitted')
  @ApiResponse('获取待下载任务队列成功')
  findSubmitted(): Promise<TaskQueue[]> {
    return this.tasksQueueService.findSubmitted();
  }

}
