import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { FindAllTaskDto } from './dto/find-all-task.dto';
import { TaskAsset } from 'src/entities/task-asset.entity';
import { TaskQueue } from 'src/entities/task-queue.entity';
import { Video } from 'src/entities/video.entity';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UploadPathService } from '../upload/upload-path.service';
import { rewriteUploadImageUrl } from '../upload/resolve-upload-path.util';
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
    private readonly uploadPathService: UploadPathService,
    // private readonly videoDownloader: VideoDownloader,
  ) { }

  async create(dto: CreateTaskDto): Promise<Task> {
    // 鍒涘缓浜嬪姟锛氫换鍔″叆搴撱€佽祫浜у叆搴撱€佷换鍔￠槦鍒楀叆搴擄紝涓変欢浜嬪繀椤诲師瀛愭彁锟?
    let imageList = dto.imageList;
    if (imageList?.length) {
      try {
        imageList = await this.uploadPathService.resolveImageListForStorage(imageList);
        imageList = imageList.map((assetPath) =>
          rewriteUploadImageUrl(assetPath),
        );
      } catch (err) {
        throw new BadRequestException((err as Error).message || '图片路径无效');
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // 1. 浠诲姟鍏ュ簱锛屾柊鍒涘缓浠诲姟榛樿 status 锟?pending
      const task = await queryRunner.manager.save(Task, {
        promptText: dto.promptText,
        productId: dto.productId,
        batchDate: dto.batchDate,
        duration: dto.duration ?? 10,
        status: 'pending',
      });
      const taskId = task.taskId;

      // 2. 濡傛灉浼犲叆锟?imageList 涓旈暱搴﹀ぇ锟?0锛屽垯涓鸿浠诲姟鍒涘缓瀵瑰簲鐨勮祫锟?
      //    涓€锟?task 瀵瑰簲澶氭潯 asset锛宎ssetType 榛樿锟?image
      if (imageList && imageList.length > 0) {
        const assets = imageList.map((assetPath, index) => ({
          taskId,
          assetType: 'image' as const,
          assetPath,
          sortOrder: index,
        }));
        await queryRunner.manager.save(TaskAsset, assets);
      }

      // 3. 浠诲姟鑷姩鍔犲叆浠诲姟闃熷垪锛屼互 taskId 浣滀负鍏宠仈
      await queryRunner.manager.save(TaskQueue, {
        taskId,
        stage: 'init',
        status: 'pending',
      });

      await queryRunner.commitTransaction();
      return task;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`鍒涘缓浠诲姟澶辫触: ${(error as Error).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(dto: FindAllTaskDto): Promise<{ list: Task[], total: number, currentPage: number, pageSize: number }> {
    const { taskId, status, productId, promptText, updatedSince, currentPage = 1, pageSize = 10, sortField, sortOrder } = dto;

    const query = this.tasksRepository.createQueryBuilder('task');
    // 闇€瑕佹妸asset涔熸煡璇㈠嚭锟?
    query.leftJoinAndSelect('task.assets', 'assets');
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

    // 璁＄畻鎬绘暟
    const total = await query.getCount();

    // 鍒嗛〉鏌ヨ锛堟寜鍒涘缓鏃堕棿鍊掑簭锛屽垪琛ㄩ『搴忕ǔ瀹氾級
    const allowedFields = ['taskId', 'createdAt'] as const;
    const sortColumn = allowedFields.includes(sortField as any)
      ? sortField
      : updatedSince ? 'updatedAt' : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const list = await query
      .orderBy(`task.${sortColumn}`, sortDirection)
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
        // 鍒犻櫎浠诲姟闃熷垪
        await manager.delete(TaskQueue, { taskId });
        // 鍒犻櫎璧勪骇
        await manager.delete(TaskAsset, { taskId });
        // 鍒犻櫎浠诲姟
        await manager.delete(Task, { taskId });
      });

      await queryRunner.commitTransaction();
    } catch (error) {
      this.logger.error(`鍒犻櫎浠诲姟澶辫触: ${(error as Error).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 閲嶆柊鐢熸垚锛氶噸缃换鍔″強鍏宠仈闃熷垪琛ㄣ€佽棰戣褰曪紝锟?tk-auto 閲嶆柊棰嗗彇澶勭悊锟?
   * 璧勪骇锛堝弬鑰冨浘锛変繚鎸佷笉鍙橈拷?
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
      this.logger.error(`閲嶆柊鐢熸垚浠诲姟澶辫触: ${(error as Error).message}`);
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
    // 浠呮洿鏂版湰娆¤姹傚疄闄呮惡甯︾殑瀛楁锛岄伩鍏嶆妸鏈紶瀛楁锛堝 promptText锛夎鐩栦负 undefined
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

