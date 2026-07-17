import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FindAllTaskQueueDto } from './dto/find-all-task-queue.dto';
import { QueueStatus, TaskQueue } from 'src/entities/task-queue.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Task } from 'src/entities/task.entity';
import { UpdateTaskQueueDto } from './dto/update-task-queue.dto';
import { ReassignTaskQueueDto } from './dto/reassign-task-queue.dto';

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

  /** 解析 excludedWorkers JSON，非法内容视为空列表 */
  parseExcludedWorkers(raw?: string | null): number[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n >= 0);
    } catch {
      return [];
    }
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
    const list = await query
      .orderBy('taskQueue.taskId', 'DESC')
      .skip((currentPage - 1) * pageSize)
      .take(pageSize)
      .getMany();
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

    const candidates = await this.tasksQueueRepository.find({
      where: [{ status: 'pending' }, { status: 'retrying' }],
      relations: {
        task: {
          assets: true,
        },
      },
      order: { queueId: 'ASC' },
    });

    // 跳过已排除当前 profile 的任务（调度器改派后）
    const queueItem = candidates.find((item) => {
      const excluded = this.parseExcludedWorkers(item.excludedWorkers);
      return !excluded.includes(profileIndex);
    });

    if (!queueItem) {
      return null;
    }

    await this.tasksQueueRepository.update(queueItem.queueId, {
      status: 'processing',
      stage: 'rendering',
      startedAt: new Date(),
      workerId,
      profileIndex,
    });
    await this.tasksRepository.update(queueItem.taskId, {
      status: 'processing',
    });

    queueItem.status = 'processing';
    queueItem.stage = 'rendering';
    queueItem.workerId = workerId;
    queueItem.profileIndex = profileIndex;
    return queueItem;
  }

  /**
   * 调度器改派：将 fromProfileIndex 记入排除列表，任务退回 pending 供其他 worker 领取。
   * 若所有可用 profile 均已排除，则标记 failed。
   */
  async reassign(
    queueId: number,
    dto: ReassignTaskQueueDto,
  ): Promise<{ reassigned: boolean; queue: TaskQueue }> {
    const queue = await this.tasksQueueRepository.findOne({
      where: { queueId },
      relations: { task: true },
    });
    if (!queue) {
      throw new NotFoundException(`TaskQueue ${queueId} not found`);
    }

    const excluded = this.parseExcludedWorkers(queue.excludedWorkers);
    if (!excluded.includes(dto.fromProfileIndex)) {
      excluded.push(dto.fromProfileIndex);
    }
    excluded.sort((a, b) => a - b);

    const maxBrowsers =
      Number.isFinite(dto.maxBrowsers) && (dto.maxBrowsers as number) > 0
        ? Math.min(dto.maxBrowsers as number, 5)
        : 5;
    const allExcluded = Array.from({ length: maxBrowsers }, (_, i) => i).every(
      (i) => excluded.includes(i),
    );

    const errorMessage =
      dto.errorMessage ??
      queue.errorMessage ??
      `worker-${dto.fromProfileIndex} 连续失败，已排除`;

    if (allExcluded) {
      queue.status = 'failed';
      queue.stage = 'rendering';
      queue.excludedWorkers = JSON.stringify(excluded);
      queue.workerId = undefined;
      queue.profileIndex = undefined;
      queue.errorMessage = `${errorMessage} | 所有 worker 均已排除，任务失败`;
      queue.completedAt = new Date();
      await this.tasksQueueRepository.save(queue);
      await this.tasksRepository.update(queue.taskId, { status: 'failed' });
      return { reassigned: false, queue };
    }

    queue.status = 'pending';
    queue.stage = 'init';
    queue.retryCount = 0;
    queue.workerId = undefined;
    queue.profileIndex = undefined;
    queue.excludedWorkers = JSON.stringify(excluded);
    queue.errorMessage = errorMessage;
    queue.completedAt = undefined;
    await this.tasksQueueRepository.save(queue);
    await this.tasksRepository.update(queue.taskId, { status: 'pending' });
    return { reassigned: true, queue };
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
