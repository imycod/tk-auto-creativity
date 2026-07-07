import { Test, TestingModule } from '@nestjs/testing';
import { TasksQueueService } from './tasks-queue.service';

describe('TasksQueueService', () => {
  let service: TasksQueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TasksQueueService],
    }).compile();

    service = module.get<TasksQueueService>(TasksQueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
