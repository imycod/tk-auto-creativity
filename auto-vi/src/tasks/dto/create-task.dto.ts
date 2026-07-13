import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  promptText!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  imageList?: string[];

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsDateString()
  batchDate?: string;

  /** 生成视频时长（秒），4-15，默认 10 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(15)
  duration?: number;
}
