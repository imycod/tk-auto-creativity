import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { FindAllTaskDto } from './dto/find-all-task.dto';
import { ApiResponse } from 'src/common/decorators/api-response.decorator';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('add') 
  @ApiResponse('创建任务成功')
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }

  @Post('list')
  findAll(@Body() dto: FindAllTaskDto) {
    return this.tasksService.findAll(dto);
  }

  @Post('update/:taskId')
  update(@Param('taskId', ParseIntPipe) taskId: number, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(taskId, dto);
  }

  @Post('regenerate/:taskId')
  @ApiResponse('任务已重置，等待重新生成')
  regenerate(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.tasksService.regenerate(taskId);
  }

  @Get(':taskId')
  findOne(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.tasksService.findOne(taskId);
  }
  
  @Delete(':taskId')
  delete(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.tasksService.delete(taskId);
  }
}
