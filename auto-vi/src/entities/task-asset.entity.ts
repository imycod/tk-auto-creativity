import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Task } from './task.entity';

export type AssetType = 'image' | 'video' | 'audio';

@Entity('task_assets')
export class TaskAsset {
  @PrimaryGeneratedColumn({ name: 'asset_id' })
  assetId!: number;

  @Column({ name: 'task_id' })
  taskId!: number;

  @ManyToOne(() => Task, (task) => task.assets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @Column({ name: 'asset_type', type: 'text' })
  assetType!: AssetType;

  @Column({ name: 'asset_path', type: 'text' })
  assetPath!: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ type: 'text', nullable: true })
  meta?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
