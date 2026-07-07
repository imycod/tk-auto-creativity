import { Test, TestingModule } from '@nestjs/testing';
import { TasksQueueController } from './tasks-queue.controller';
import { TasksQueueService } from './tasks-queue.service';

describe('TasksQueueController', () => {
  let controller: TasksQueueController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksQueueController],
      providers: [TasksQueueService],
    }).compile();

    controller = module.get<TasksQueueController>(TasksQueueController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
