import { PartialType } from '@nestjs/mapped-types';
import { CreateTasksQueueDto } from './create-tasks-queue.dto';

export class UpdateTasksQueueDto extends PartialType(CreateTasksQueueDto) {}
