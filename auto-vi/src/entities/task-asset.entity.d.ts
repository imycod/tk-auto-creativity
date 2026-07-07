import { Task } from './task.entity';
export type AssetType = 'image' | 'video' | 'audio';
export declare class TaskAsset {
    assetId: number;
    taskId: number;
    task: Task;
    assetType: AssetType;
    assetPath: string;
    sortOrder: number;
    meta?: string;
    createdAt: Date;
}
