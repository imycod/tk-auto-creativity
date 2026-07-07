import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
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
  @Transform(({ value }) => (value === '' || value === null) ? undefined : value)
  @IsEnum(TaskStatus)
  status?: TaskStatus;

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
}