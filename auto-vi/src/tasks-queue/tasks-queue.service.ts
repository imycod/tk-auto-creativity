import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTasksQueueDto } from './dto/create-tasks-queue.dto';
import { UpdateTasksQueueDto } from './dto/update-tasks-queue.dto';
import { FindAllTaskQueueDto } from './dto/find-all-task-queue.dto';
import { QueueStatus, TaskQueue } from 'src/entities/task-queue.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Task, TaskStatus } from 'src/entities/task.entity';
import { UpdateTaskQueueDto } from './dto/update-task-queue.dto';

@Injectable()
export class TasksQueueService {
  constructor(
    @InjectRepository(TaskQueue)
    private readonly tasksQueueRepository: Repository<TaskQueue>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>, 
  ) { }


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
    // 计算总数
    const total = await query.getCount();
    // 分页查询
    const list = await query.skip((currentPage - 1) * pageSize).take(pageSize).getMany();
    return { list, total, currentPage, pageSize };
  }

  async findWithStatuss(statuss: QueueStatus[]): Promise<number> {
    const count = await this.tasksQueueRepository.count({
      where: [{ status: In(statuss) }],
    });
    return count;
  }

  async findQueueClaim(workerId: string): Promise<TaskQueue | null> {
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
    // 注意：这里要更新的是任务表（tasks），之前误用了 taskQueuesRepository 且以 taskId 当主键
    await this.tasksRepository.update(queueItem.taskId, {
      status: 'processing',
    });

    return queueItem;
  }

  async update(queueId: number, dto: UpdateTaskQueueDto): Promise<TaskQueue> {
    const queue = await this.tasksQueueRepository.findOne({
      where: { queueId },
    });
    console.log('queue---',queue)
    if (!queue) {
      throw new NotFoundException(`TaskQueue ${queueId} not found`);
    }
    // 之前漏掉了这一步：必须把 dto 合并进实体，否则状态/阶段等更新永远不会落库
    Object.assign(queue, dto);
    console.log('queue---',queue)
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
