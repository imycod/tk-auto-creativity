import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateVideoDto {
    @IsNumber()
    @IsOptional()
    taskId?: number;

    @IsString()
    @IsOptional()
    filePath?: string;

    @IsString()
    @IsOptional()
    promptText?: string;
}
