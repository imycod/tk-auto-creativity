import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum TaskStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  QUEUED = 'queued',
  PROCESSING = 'processing',
}

export class FindAllTaskDto {
  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' || value === null) ? undefined : value)
  promptText?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null) ? undefined : value)
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  /** 仅返�?updatedAt >= 该时间的任务（用于通知轮询�?*/
  @IsOptional()
  @IsDateString()
  updatedSince?: string;

  // 新增分页参数
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