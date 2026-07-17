import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { Transform, Type } from 'class-transformer';

export enum QueueStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    RETRYING = 'retrying',
    SUBMITTED = 'submitted',
}

export enum QueueStage {
    INIT = 'init',
    PREPROCESS = 'preprocess',
    RENDERING = 'rendering',
    POSTPROCESS = 'postprocess',
}

export class FindAllTaskQueueDto {
    @IsOptional()
    @IsString()
    taskId?: string;
    
    @IsOptional()
    @IsString()
    queueId?: string;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => (value === '' || value === null) ? undefined : value)
    @IsEnum(QueueStatus)
    status?: QueueStatus;   

    @IsOptional()
    @IsString()
    @Transform(({ value }) => (value === '' || value === null) ? undefined : value)
    @IsEnum(QueueStage)
    stage?: QueueStage;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    currentPage?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsNumber() 
    @Min(1)
    pageSize?: number = 10;
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' || value === null) ? undefined : value)
  sortField?: 'taskId' | 'createdAt';

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' || value === null) ? undefined : value)
  sortOrder?: 'asc' | 'desc';
}