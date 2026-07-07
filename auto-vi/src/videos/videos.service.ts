import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video } from 'src/entities/video.entity';

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video)
    private readonly videosRepository: Repository<Video>,
  ) {}

  create(createVideoDto: CreateVideoDto) {
    return this.videosRepository.save(createVideoDto);
  }

  findByTaskId(taskId: number): Promise<Video | null> {
    return this.videosRepository.findOne({ where: { taskId } });
  }

  findOne(videoId: number): Promise<Video> {
    return this.videosRepository.findOne({ where: { videoId } }).then((video) => {
      if (!video) {
        throw new NotFoundException(`Video ${videoId} not found`);
      }
      return video;
    });
  }

  /** 按 taskId 写入或更新视频记录（下载阶段使用） */
  async upsertByTaskId(
    taskId: number,
    dto: UpdateVideoDto,
  ): Promise<Video> {
    const existing = await this.findByTaskId(taskId);
    if (existing) {
      Object.assign(existing, dto);
      return this.videosRepository.save(existing);
    }
    return this.videosRepository.save({ taskId, ...dto });
  }

  update(videoId: number, updateVideoDto: UpdateVideoDto) {
    return this.videosRepository.update(videoId, updateVideoDto);
  }

  remove(videoId: number) {
    return this.videosRepository.delete(videoId);
  }
}
