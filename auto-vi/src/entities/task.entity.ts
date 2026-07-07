import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TaskQueue } from './task-queue.entity';
import { TaskAsset } from './task-asset.entity';
import { Video } from './video.entity';

export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'retrying';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn({ name: 'task_id' })
  taskId!: number;

  @Column({ name: 'prompt_text', type: 'text' })
  promptText!: string;

  @Column({
    type: 'text',
    default: 'pending',
  })
  status!: TaskStatus;

  @Column({ name: 'product_id', type: 'text', nullable: true })
  productId?: string;

  @Column({ name: 'batch_date', type: 'date', nullable: true })
  batchDate?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: true })
  updatedAt?: Date;

  @OneToMany(() => TaskQueue, (queue) => queue.task)
  queues!: TaskQueue[];

  @OneToMany(() => TaskAsset, (asset) => asset.task)
  assets!: TaskAsset[];

  @OneToOne(() => Video, (video) => video.task)
  video?: Video;
}
