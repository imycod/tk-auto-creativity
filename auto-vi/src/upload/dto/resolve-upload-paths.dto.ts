import { IsArray, IsString } from 'class-validator';

export class ResolveUploadPathsDto {
  @IsArray()
  @IsString({ each: true })
  paths!: string[];
}
