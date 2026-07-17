import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Task } from './task.entity';

export type QueueStage = 'init' | 'preprocess' | 'rendering' | 'postprocess';
export type QueueStatus =
  | 'pending'
  | 'processing'
  | 'submitted'
  | 'completed'
  | 'failed'
  | 'retrying';

@Entity('task_queue')
export class TaskQueue {
  @PrimaryGeneratedColumn({ name: 'queue_id' })
  queueId!: number;

  @Column({ name: 'task_id' })
  taskId!: number;

  @ManyToOne(() => Task, (task) => task.queues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @Column({
    type: 'text',
    default: 'init',
  })
  stage!: QueueStage;

  @Column({
    type: 'text',
    default: 'pending',
  })
  status!: QueueStatus;

  @Column({ name: 'retry_count', default: 0 })
  retryCount!: number;

  @Column({ name: 'worker_id', type: 'text', nullable: true })
  workerId?: string;

  /** 处理该任务的浏览器 profile 序号（与 worker 一一对应），用于下载阶段定位浏览器 */
  @Column({ name: 'profile_index', type: 'integer', nullable: true })
  profileIndex?: number;

  /**
   * 提交生成时所在浏览器页面已有的视频卡片数量。
   * 新视频追加在列表末尾（视觉置顶），因此该任务对应的卡片始终位于第 renderIndex 个，
   * 下载阶段据此定位要回收的视频。
   */
  @Column({ name: 'render_index', type: 'integer', nullable: true })
  renderIndex?: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  /**
   * 已被调度器排除的 worker profile 列表（JSON 数组，如 "[0,1]"）。
   * 这些 profile 因登录失败/积分不足等连续失败后不再领取本任务。
   */
  @Column({ name: 'excluded_workers', type: 'text', nullable: true })
  excludedWorkers?: string;

  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
