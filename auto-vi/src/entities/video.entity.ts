import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Task } from './task.entity';

@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn({ name: 'video_id' })
  videoId!: number;

  @Column({ name: 'task_id', unique: true })
  taskId!: number;

  @OneToOne(() => Task, (task) => task.video, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @Column({ name: 'file_path', type: 'text' })
  filePath!: string;

  /** 下载时从页面视频块读取到的 promptText */
  @Column({ name: 'prompt_text', type: 'text', nullable: true })
  promptText?: string;

  @Column({ type: 'integer', nullable: true })
  duration?: number;

  @Column({ type: 'text', nullable: true })
  resolution?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
