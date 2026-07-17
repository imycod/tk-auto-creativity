import { IsNumber, IsOptional, IsString } from 'class-validator';

export class ReassignTaskQueueDto {
  @IsNumber()
  fromProfileIndex!: number;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  /** 可用浏览器总数，用于判断是否所有 worker 都已排除 */
  @IsOptional()
  @IsNumber()
  maxBrowsers?: number;
}
