import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FindAllTaskQueueDto } from './dto/find-all-task-queue.dto';
import { QueueStatus, TaskQueue } from 'src/entities/task-queue.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Task } from 'src/entities/task.entity';
import { UpdateTaskQueueDto } from './dto/update-task-queue.dto';

@Injectable()
export class TasksQueueService {
  private readonly maxConcurrentPerProfile: number;

  constructor(
    @InjectRepository(TaskQueue)
    private readonly tasksQueueRepository: Repository<TaskQueue>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    private readonly configService: ConfigService,
  ) {
    const configured = Number(
      this.configService.get('MAX_CONCURRENT_PER_PROFILE'),
    );
    this.maxConcurrentPerProfile =
      Number.isFinite(configured) && configured > 0 ? configured : 3;
  }

  async countSubmittedByProfile(profileIndex: number): Promise<number> {
    return this.tasksQueueRepository.count({
      where: { status: 'submitted', profileIndex },
    });
  }

  async findAll(dto: FindAllTaskQueueDto): Promise<{ list: TaskQueue[], total: number, currentPage: number, pageSize: number }> {
    const { taskId, status, stage, queueId, currentPage = 1, pageSize = 10 } = dto;
    const query = this.tasksQueueRepository.createQueryBuilder('taskQueue');
    if (taskId) {
      query.andWhere('taskQueue.taskId = :taskId', { taskId });
    }
    if (queueId) {
      query.andWhere('taskQueue.queueId = :queueId', { queueId });
    }
    if (status) {
      query.andWhere('taskQueue.status = :status', { status });
    }
    if (stage) {
      query.andWhere('taskQueue.stage = :stage', { stage });
    }
    const total = await query.getCount();
    const list = await query.skip((currentPage - 1) * pageSize).take(pageSize).getMany();
    return { list, total, currentPage, pageSize };
  }

  async findWithStatuss(statuss: QueueStatus[]): Promise<number> {
    const count = await this.tasksQueueRepository.count({
      where: [{ status: In(statuss) }],
    });
    return count;
  }

  async findQueueClaim(
    workerId: string,
    profileIndex: number,
  ): Promise<TaskQueue | null> {
    const inFlight = await this.countSubmittedByProfile(profileIndex);
    if (inFlight >= this.maxConcurrentPerProfile) {
      return null;
    }

    const queueItem = await this.tasksQueueRepository.findOne({
      where: [{ status: 'pending' }, { status: 'retrying' }],
      relations: {
        task: {
          assets: true,
        },
      },
      order: { queueId: 'ASC' },
    });

    if (!queueItem) {
      return null;
    }

    await this.tasksQueueRepository.update(queueItem.queueId, {
      status: 'processing',
      stage: 'rendering',
      startedAt: new Date(),
      workerId,
    });
    await this.tasksRepository.update(queueItem.taskId, {
      status: 'processing',
    });

    return queueItem;
  }

  async update(queueId: number, dto: UpdateTaskQueueDto): Promise<TaskQueue> {
    const queue = await this.tasksQueueRepository.findOne({
      where: { queueId },
    });
    if (!queue) {
      throw new NotFoundException(`TaskQueue ${queueId} not found`);
    }
    Object.assign(queue, dto);
    return await this.tasksQueueRepository.save(queue);
  }

  async findSubmitted(): Promise<TaskQueue[]> {
    return await this.tasksQueueRepository.find({
      where: { status: 'submitted' },
      relations: {
        task: true,
      },
      order: { queueId: 'ASC' },
    });
  }
}
