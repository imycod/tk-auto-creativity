import { TaskQueue } from './task-queue.entity';
import { TaskAsset } from './task-asset.entity';
import { Video } from './video.entity';
export type TaskStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed';
export declare class Task {
    taskId: number;
    promptText: string;
    status: TaskStatus;
    productId?: string;
    batchDate?: string;
    createdAt: Date;
    updatedAt?: Date;
    queues: TaskQueue[];
    assets: TaskAsset[];
    video?: Video;
}
