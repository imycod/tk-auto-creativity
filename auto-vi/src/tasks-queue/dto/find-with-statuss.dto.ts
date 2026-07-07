import { IsArray, IsEnum, IsOptional, IsString } from "class-validator";
import { QueueStatus } from "./find-all-task-queue.dto"

export class FindWithStatussDto {
    @IsArray()
    @IsEnum(QueueStatus, { each: true })
    statuss?: QueueStatus[];
}