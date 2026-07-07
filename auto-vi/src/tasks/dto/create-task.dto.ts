import { IsArray, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
