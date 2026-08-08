import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateTaskAssetDto {
  @IsIn(['image', 'video'])
  assetType!: 'image' | 'video';

  @IsString()
  @IsNotEmpty()
  assetPath!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  meta?: unknown;
}

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  promptText!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  imageList?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CreateTaskAssetDto)
  assets?: CreateTaskAssetDto[];

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
