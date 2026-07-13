import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { FindAllTaskDto } from './dto/find-all-task.dto';
import { TaskAsset } from 'src/entities/task-asset.entity';
import { TaskQueue } from 'src/entities/task-queue.entity';
import { Video } from 'src/entities/video.entity';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FindAllTaskQueueDto } from '../tasks-queue/dto/find-all-task-queue.dto';
import { UpdateTaskQueueDto } from '../tasks-queue/dto/update-task-queue.dto';
// import { VideoDownloader } from './video.downloader';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    private readonly dataSource: DataSource,
    @InjectRepository(TaskQueue)
    private readonly taskQueuesRepository: Repository<TaskQueue>,
    // private readonly videoDownloader: VideoDownloader,
  ) { }

  async create(dto: CreateTaskDto): Promise<Task> {
    // 创建事务：任务入库、资产入库、任务队列入库，三件事必须原子提交
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // 1. 任务入库，新创建任务默认 status 为 pending
      const task = await queryRunner.manager.save(Task, {
        promptText: dto.promptText,
        productId: dto.productId,
        batchDate: dto.batchDate,
        duration: dto.duration ?? 10,
        status: 'pending',
      });
      const taskId = task.taskId;

      // 2. 如果传入了 imageList 且长度大于 0，则为该任务创建对应的资产
      //    一个 task 对应多条 asset，assetType 默认为 image
      if (dto.imageList && dto.imageList.length > 0) {
        const assets = dto.imageList.map((assetPath, index) => ({
          taskId,
          assetType: 'image' as const,
          assetPath,
          sortOrder: index,
        }));
        await queryRunner.manager.save(TaskAsset, assets);
      }

      // 3. 任务自动加入任务队列，以 taskId 作为关联
      await queryRunner.manager.save(TaskQueue, {
        taskId,
        stage: 'init',
        status: 'pending',
      });

      await queryRunner.commitTransaction();
      return task;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`创建任务失败: ${(error as Error).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(dto: FindAllTaskDto): Promise<{ list: Task[], total: number, currentPage: number, pageSize: number }> {
    const { taskId, status, productId, currentPage = 1, pageSize = 10 } = dto;

    const query = this.tasksRepository.createQueryBuilder('task');
    // 需要把asset也查询出来
    query.leftJoinAndSelect('task.assets', 'assets');
    if (productId) {
      query.andWhere('task.productId = :productId', { productId });
    }
    if (taskId) {
      query.andWhere('task.taskId = :taskId', { taskId });
    }
    if (status) {
      query.andWhere('task.status = :status', { status });
    }

    // 计算总数
    const total = await query.getCount();

    // 分页查询（按创建时间倒序，列表顺序稳定）
    const list = await query
      .orderBy('task.createdAt', 'DESC')
      .skip((currentPage - 1) * pageSize)
      .take(pageSize)
      .getMany();

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
        // 删除任务队列
        await manager.delete(TaskQueue, { taskId });
        // 删除资产
        await manager.delete(TaskAsset, { taskId });
        // 删除任务
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
   * 重新生成：重置任务及关联队列表、视频记录，使 tk-auto 重新领取处理。
   * 资产（参考图）保持不变。
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
    // 仅更新本次请求实际携带的字段，避免把未传字段（如 promptText）覆盖为 undefined
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

}
