export declare class Task {
    taskId: number;
    promptText: string;
    status: TaskStatus;
    productId?: string;
    batchDate?: string;
    createdAt: Date;
    updatedAt?: Date;
}