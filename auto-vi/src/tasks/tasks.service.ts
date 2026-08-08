import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import { CreateTaskAssetDto, CreateTaskDto } from './dto/create-task.dto';
import { FindAllTaskDto } from './dto/find-all-task.dto';
import { TaskAsset } from '../entities/task-asset.entity';
import { TaskQueue } from '../entities/task-queue.entity';
import { Video } from '../entities/video.entity';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UploadPathService } from '../upload/upload-path.service';
import { FindAllTaskQueueDto } from '../tasks-queue/dto/find-all-task-queue.dto';
import { UpdateTaskQueueDto } from '../tasks-queue/dto/update-task-queue.dto';
// import { VideoDownloader } from './video.downloader';

interface NormalizedTaskAsset {
  assetType: 'image' | 'video';
  assetPath: string;
  sortOrder: number;
  meta?: string;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    private readonly dataSource: DataSource,
    @InjectRepository(TaskQueue)
    private readonly taskQueuesRepository: Repository<TaskQueue>,
    private readonly uploadPathService: UploadPathService,
    // private readonly videoDownloader: VideoDownloader,
  ) { }

  async create(dto: CreateTaskDto): Promise<Task> {
    const assets = await this.normalizeAssets(dto);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // 1. 任务入库，新创建任务默认 status = pending
      const task = await queryRunner.manager.save(Task, {
        promptText: dto.promptText,
        productId: dto.productId,
        batchDate: dto.batchDate,
        duration: dto.duration ?? 10,
        status: 'pending',
      });
      const taskId = task.taskId;

      if (assets.length > 0) {
        await queryRunner.manager.save(
          TaskAsset,
          assets.map((asset) => ({
            taskId,
            assetType: asset.assetType,
            assetPath: asset.assetPath,
            sortOrder: asset.sortOrder,
            meta: asset.meta,
          })),
        );
      }

      // 3. 任务自动加入任务队列，以 taskId 作为关联
      await queryRunner.manager.save(TaskQueue, {
        taskId,
        stage: 'init',
        status: 'pending',
      });

      await queryRunner.commitTransaction();
      return this.findOne(taskId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`创建任务失败: ${(error as Error).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(dto: FindAllTaskDto): Promise<{ list: Task[], total: number, currentPage: number, pageSize: number }> {
    const { taskId, status, productId, promptText, updatedSince, currentPage = 1, pageSize = 10, sortField, sortOrder } = dto;

    const query = this.tasksRepository.createQueryBuilder('task');
    query.leftJoinAndSelect('task.assets', 'assets');
    query.leftJoinAndSelect('task.queues', 'queues');
    if (productId) {
      query.andWhere('task.productId = :productId', { productId });
    }
    if (promptText) {
      query.andWhere('task.promptText LIKE :promptText', {
        promptText: `%${promptText}%`,
      });
    }
    if (taskId) {
      query.andWhere('task.taskId = :taskId', { taskId });
    }
    if (status) {
      query.andWhere('task.status = :status', { status });
    }
    if (updatedSince) {
      query.andWhere(
        'datetime(task.updatedAt) >= datetime(:updatedSince)',
        { updatedSince: new Date(updatedSince).toISOString() },
      );
    }

    const total = await query.getCount();

    const allowedFields = ['taskId', 'createdAt'] as const;
    const sortColumn = allowedFields.includes(sortField as any)
      ? sortField
      : updatedSince ? 'updatedAt' : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const list = await query
      .orderBy(`task.${sortColumn}`, sortDirection)
      .addOrderBy('assets.sortOrder', 'ASC')
      .addOrderBy('assets.assetId', 'ASC')
      .skip((currentPage - 1) * pageSize)
      .take(pageSize)
      .getMany();

    list.forEach((task) => this.sortAssets(task));

    return {
      list,
      total,
      currentPage,
      pageSize,
    };
  }

  async findOne(taskId: number): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { taskId },
      relations: ['queues', 'assets', 'video'],
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    this.sortAssets(task);
    return task;
  }

  async delete(taskId: number): Promise<void> {
    const task = await this.tasksRepository.findOne({
      where: { taskId },
    });
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {

      await this.dataSource.transaction(async (manager) => {
        await manager.delete(TaskQueue, { taskId });
        await manager.delete(TaskAsset, { taskId });
        await manager.delete(Task, { taskId });
      });

      await queryRunner.commitTransaction();
    } catch (error) {
      this.logger.error(`删除任务失败: ${(error as Error).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Regenerate the task and its queue/video state while preserving media assets.
   */
  async regenerate(taskId: number): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { taskId },
      relations: ['queues'],
    });
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      task.status = 'pending';
      await queryRunner.manager.save(Task, task);

      await queryRunner.manager.delete(Video, { taskId });

      if (task.queues?.length) {
        for (const queue of task.queues) {
          Object.assign(queue, {
            stage: 'init',
            status: 'pending',
            retryCount: 0,
            workerId: null,
            profileIndex: null,
            renderIndex: null,
            errorMessage: null,
            excludedWorkers: null,
            scheduleRound: 0,
            startedAt: null,
            completedAt: null,
          });
          await queryRunner.manager.save(TaskQueue, queue);
        }
      } else {
        await queryRunner.manager.save(TaskQueue, {
          taskId,
          stage: 'init',
          status: 'pending',
        });
      }

      await queryRunner.commitTransaction();
      return this.findOne(taskId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`重新生成任务失败: ${(error as Error).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(taskId: number, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { taskId },
    });
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }
    if (dto.promptText !== undefined) {
      task.promptText = dto.promptText;
    }
    if (dto.productId !== undefined) {
      task.productId = dto.productId;
    }
    if (dto.status !== undefined) {
      task.status = dto.status as Task['status'];
    }
    return await this.tasksRepository.save(task);
  }

  private async normalizeAssets(dto: CreateTaskDto): Promise<NormalizedTaskAsset[]> {
    const hasAssets = (dto.assets?.length ?? 0) > 0;
    const hasImageList = (dto.imageList?.length ?? 0) > 0;

    if (hasAssets && hasImageList) {
      throw new BadRequestException('assets and imageList cannot both be provided');
    }

    // assets is the primary mixed-media contract; imageList remains for legacy image tasks.
    const incomingAssets: CreateTaskAssetDto[] = hasAssets
      ? dto.assets!
      : (dto.imageList ?? []).map((assetPath, index) => ({
          assetType: 'image' as const,
          assetPath,
          sortOrder: index,
        }));

    if (!incomingAssets.length) {
      throw new BadRequestException('At least one media asset is required');
    }
    if (incomingAssets.length > 10) {
      throw new BadRequestException('No more than 10 media assets are allowed');
    }

    const normalized = await Promise.all(
      incomingAssets.map(async (asset, index) => {
        const assetType = asset.assetType;
        if (assetType !== 'image' && assetType !== 'video') {
          throw new BadRequestException('assetType must be image or video');
        }
        const sortOrder = asset.sortOrder ?? index;
        if (!Number.isInteger(sortOrder) || sortOrder < 0) {
          throw new BadRequestException('sortOrder must be a non-negative integer');
        }
        try {
          return {
            assetType,
            assetPath: await this.uploadPathService.resolveMediaForStorage(
              asset.assetPath,
              assetType,
            ),
            sortOrder,
            meta: asset.meta === undefined ? undefined : JSON.stringify(asset.meta),
            originalIndex: index,
          };
        } catch (err) {
          throw new BadRequestException((err as Error).message || '素材路径无效');
        }
      }),
    );

    return normalized
      .sort((a, b) => a.sortOrder - b.sortOrder || a.originalIndex - b.originalIndex)
      .map(({ originalIndex: _originalIndex, ...asset }) => asset);
  }

  private sortAssets(task: Task): void {
    task.assets = [...(task.assets ?? [])].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.assetId ?? 0) - (b.assetId ?? 0),
    );
  }
}
