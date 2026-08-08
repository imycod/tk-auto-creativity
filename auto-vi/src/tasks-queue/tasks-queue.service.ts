import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { FindAllTaskQueueDto } from './dto/find-all-task-queue.dto';
import { QueueStatus, TaskQueue } from 'src/entities/task-queue.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Task } from 'src/entities/task.entity';
import { UpdateTaskQueueDto } from './dto/update-task-queue.dto';
import { ReassignTaskQueueDto } from './dto/reassign-task-queue.dto';

@Injectable()
export class TasksQueueService implements OnModuleInit {
  private readonly logger = new Logger(TasksQueueService.name);
  private readonly maxConcurrentPerProfile: number;
  private readonly maxBrowsers: number;
  private readonly maxScheduleRounds: number;

  constructor(
    @InjectRepository(TaskQueue)
    private readonly tasksQueueRepository: Repository<TaskQueue>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    const configured = Number(
      this.configService.get('MAX_CONCURRENT_PER_PROFILE'),
    );
    this.maxConcurrentPerProfile =
      Number.isFinite(configured) && configured > 0 ? configured : 3;
    const maxBrowsersConfigured = Number(this.configService.get('MAX_BROWSERS'));
    this.maxBrowsers =
      Number.isFinite(maxBrowsersConfigured) && maxBrowsersConfigured > 0
        ? Math.min(maxBrowsersConfigured, 10)
        : 5;
    const maxRoundsConfigured = Number(
      this.configService.get('SCHEDULER_MAX_ROUNDS'),
    );
    this.maxScheduleRounds =
      Number.isFinite(maxRoundsConfigured) && maxRoundsConfigured > 0
        ? maxRoundsConfigured
        : 3;
  }

  
  async onModuleInit(): Promise<void> {
    await this.ensureScheduleRoundColumn();
  }

  /** production 下 synchronize=false 时补齐 schedule_round 列 */
  private async ensureScheduleRoundColumn(): Promise<void> {
    try {
      const rows = await this.dataSource.query(
        `PRAGMA table_info('task_queue')`,
      );
      const hasColumn = rows.some((r) => r.name === 'schedule_round');
      if (!hasColumn) {
        await this.dataSource.query(
          `ALTER TABLE task_queue ADD COLUMN schedule_round integer NOT NULL DEFAULT 0`,
        );
        this.logger.log('已为 task_queue 添加 schedule_round 列');
      }
    } catch (error) {
      this.logger.error(
        `检查/添加 schedule_round 列失败: ${(error as Error).message}`,
      );
    }
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
    const { taskId, status, stage, queueId, currentPage = 1, pageSize = 10, sortField, sortOrder } = dto;
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
    const allowedFields = ['taskId', 'createdAt'] as const;
    const sortColumn = allowedFields.includes(sortField as any) ? sortField : 'taskId';
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const list = await query
      .orderBy(`taskQueue.${sortColumn}`, sortDirection)
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

    if (queueItem.task?.assets) {
      queueItem.task.assets = [...queueItem.task.assets].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.assetId ?? 0) - (b.assetId ?? 0),
      );
    }

    queueItem.status = 'processing';
    queueItem.stage = 'rendering';
    queueItem.workerId = workerId;
    queueItem.profileIndex = profileIndex;
    return queueItem;
  }

    /**
   * 调度器改派：将 fromProfileIndex 记入排除列表，任务退回 pending 供其他 worker 领取。
   * 本轮所有可用 profile 均已排除时：若未满 maxScheduleRounds 轮则清空排除并开启下一轮；
   * 否则标记 failed。
   */
  async reassign(
    queueId: number,
    dto: ReassignTaskQueueDto,
  ): Promise<{ reassigned: boolean; queue: TaskQueue; scheduleRound?: number }> {
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
        ? Math.min(dto.maxBrowsers as number, 10)
        : this.maxBrowsers;
    const allExcluded = Array.from({ length: maxBrowsers }, (_, i) => i).every(
      (i) => excluded.includes(i),
    );

    const errorMessage =
      dto.errorMessage ??
      queue.errorMessage ??
      `worker-${dto.fromProfileIndex} 连续失败，已排除`;

    const currentRound = queue.scheduleRound ?? 0;

    if (allExcluded) {
      const nextRound = currentRound + 1;
      if (nextRound < this.maxScheduleRounds) {
        queue.status = 'pending';
        queue.stage = 'init';
        queue.retryCount = 0;
        queue.workerId = undefined;
        queue.profileIndex = undefined;
        queue.excludedWorkers = undefined;
        queue.scheduleRound = nextRound;
        queue.errorMessage = `${errorMessage} | 第 ${nextRound}/${this.maxScheduleRounds} 轮大重试开始`;
        queue.completedAt = undefined;
        await this.tasksQueueRepository.save(queue);
        await this.tasksRepository.update(queue.taskId, { status: 'pending' });
        this.logger.warn(
          `[reassign] 任务 ${queue.taskId} 开启第 ${nextRound}/${this.maxScheduleRounds} 轮大重试`,
        );
        return { reassigned: true, queue, scheduleRound: nextRound };
      }

      queue.status = 'failed';
      queue.stage = 'rendering';
      queue.excludedWorkers = JSON.stringify(excluded);
      queue.scheduleRound = nextRound;
      queue.workerId = undefined;
      queue.profileIndex = undefined;
      queue.errorMessage = `${errorMessage} | 已轮换 ${this.maxScheduleRounds} 轮仍失败，任务失败`;
      queue.completedAt = new Date();
      await this.tasksQueueRepository.save(queue);
      await this.tasksRepository.update(queue.taskId, { status: 'failed' });
      this.logger.error(
        `[reassign] 任务 ${queue.taskId} 已轮换 ${this.maxScheduleRounds} 轮仍失败`,
      );
      return { reassigned: false, queue, scheduleRound: nextRound };
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
    return { reassigned: true, queue, scheduleRound: currentRound };
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


  /**
   * 每小时扫描：pending/retrying 超过 1 天，或排除列表已覆盖全部 worker 却仍 pending 的脏数据 → failed。
   */
  @Interval(60 * 60 * 1000)
  async failStalePendingQueues(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const candidates = await this.tasksQueueRepository.find({
      where: [
        { status: 'pending' },
        { status: 'retrying' },
      ],
    });

    let failedCount = 0;
    for (const queue of candidates) {
      const excluded = this.parseExcludedWorkers(queue.excludedWorkers);
      const allExcluded = Array.from({ length: this.maxBrowsers }, (_, i) =>
        i,
      ).every((i) => excluded.includes(i));
      const isStale =
        queue.createdAt && new Date(queue.createdAt).getTime() <= cutoff.getTime();

      if (!isStale && !allExcluded) continue;

      const reason = allExcluded
        ? `排除列表已覆盖全部 worker(0..${this.maxBrowsers - 1}) 但仍处于 ${queue.status}，自动标记失败`
        : `创建超过 1 天仍处于 ${queue.status}，自动标记失败`;

      queue.status = 'failed';
      queue.stage = queue.stage || 'rendering';
      queue.errorMessage = reason;
      queue.completedAt = new Date();
      queue.workerId = undefined;
      queue.profileIndex = undefined;
      await this.tasksQueueRepository.save(queue);
      await this.tasksRepository.update(queue.taskId, { status: 'failed' });
      failedCount += 1;
      this.logger.warn(`[stale] 队列 ${queue.queueId} 任务 ${queue.taskId}: ${reason}`);
    }

    if (failedCount > 0) {
      this.logger.warn(`[stale] 本轮自动失败 ${failedCount} 条队列任务`);
    }
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
