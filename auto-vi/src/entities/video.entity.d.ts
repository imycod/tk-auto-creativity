import { Task } from './task.entity';
export declare class Video {
    videoId: number;
    taskId: number;
    task: Task;
    filePath: string;
    duration?: number;
    resolution?: string;
    createdAt: Date;
}
