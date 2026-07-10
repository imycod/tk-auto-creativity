import { IsString, IsNumber, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTaskQueueDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsNumber()
  profileIndex?: number | null;

  @IsOptional()
  @IsString()
  workerId?: string | null;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsNumber()
  retryCount?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  completedAt?: Date;
}
