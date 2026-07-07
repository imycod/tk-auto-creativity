import { Task } from './task.entity';
export type QueueStage = 'init' | 'preprocess' | 'rendering' | 'postprocess';
export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
export declare class TaskQueue {
    queueId: number;
    taskId: number;
    task: Task;
    stage: QueueStage;
    status: QueueStatus;
    retryCount: number;
    workerId?: string;
    errorMessage?: string;
    startedAt?: Date;
    completedAt?: Date;
    createdAt: Date;
}
