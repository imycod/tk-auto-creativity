import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { VideosService } from './videos.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { ApiResponse } from 'src/common/decorators/api-response.decorator';

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post()
  @ApiResponse('创建视频记录成功')
  create(@Body() createVideoDto: CreateVideoDto) {
    return this.videosService.create(createVideoDto);
  }

  /** 按 taskId 查询（下载器使用，须在 :id 路由之前声明） */
  @Get('by-task/:taskId')
  @ApiResponse('查询任务视频成功')
  async findByTask(@Param('taskId', ParseIntPipe) taskId: number) {
    const video = await this.videosService.findByTaskId(taskId);
    if (!video) {
      throw new NotFoundException(`Task ${taskId} has no video record`);
    }
    return video;
  }

  /** 按 taskId 写入或更新视频记录（下载器回写使用） */
  @Patch('by-task/:taskId')
  @ApiResponse('保存任务视频成功')
  upsertByTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: UpdateVideoDto,
  ) {
    return this.videosService.upsertByTaskId(taskId, dto);
  }

  @Get(':id')
  @ApiResponse('查询视频成功')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.videosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateVideoDto: UpdateVideoDto,
  ) {
    return this.videosService.update(id, updateVideoDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.videosService.remove(id);
  }
}
