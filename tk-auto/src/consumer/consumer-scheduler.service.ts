import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { InsufficientCreditsError } from '../core/browser/creative-studio.helper';
import { RemoteTaskQueue } from './interface/remote-task-queue.dto';

export interface ReassignResult {
  /** true = 已改派给其他 worker；false = 所有 worker 排除后最终失败 */
  reassigned: boolean;
  errorMessage: string;
}

/**
 * Consumer 调度器：当某 worker 因登录/积分等可改派错误连续失败达上限后，
 * 将该任务改派给其他 worker，并更新队列里的 worker / excludedWorkers 记录。
 * 不改变原有成功路径与不可改派错误的失败逻辑。
 */
@Injectable()
export class ConsumerSchedulerService {
  private readonly logger = new Logger(ConsumerSchedulerService.name);
  private readonly autoViApiUrl: string;
  private readonly maxBrowsers: number;
  /** 同一 worker 连续失败多少次后触发改派（默认 3） */
  private readonly maxWorkerFailures: number;
  /** queueId -> profileIndex -> 该 worker 对本任务的失败次数 */
  private readonly workerFailCounts = new Map<number, Map<number, number>>();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.autoViApiUrl = this.configService.get('AUTO_VI_API_URL') as string;
    const configured = Number(this.configService.get('MAX_BROWSERS'));
    this.maxBrowsers =
      Number.isFinite(configured) && configured > 0
        ? Math.min(configured, 5)
        : 5;
    const maxFails = Number(this.configService.get('SCHEDULER_MAX_WORKER_FAILURES'));
    this.maxWorkerFailures =
      Number.isFinite(maxFails) && maxFails > 0 ? maxFails : 3;
  }

  /**
   * 可改派错误：积分不足、未登录/页面未就绪（chatbox 超时）、loadState 超时等。
   * 这类错误换 profile 后可能恢复，适合调度给其他 worker。
   */
  isReassignableError(error: unknown): boolean {
    if (error instanceof InsufficientCreditsError) return true;
    const message = (error as Error)?.message ?? '';
    if (/积分不够|无法读取当前积分/i.test(message)) return true;
    if (/waitForSelector/i.test(message) && /chatbox-part/i.test(message)) {
      return true;
    }
    if (/waitForLoadState/i.test(message) && /Timeout/i.test(message)) {
      return true;
    }
    return false;
  }

  /** 记录本 worker 对本任务的一次失败，返回累计次数 */
  recordWorkerFailure(queueId: number, profileIndex: number): number {
    let byProfile = this.workerFailCounts.get(queueId);
    if (!byProfile) {
      byProfile = new Map();
      this.workerFailCounts.set(queueId, byProfile);
    }
    const next = (byProfile.get(profileIndex) ?? 0) + 1;
    byProfile.set(profileIndex, next);
    return next;
  }

  getWorkerFailureCount(queueId: number, profileIndex: number): number {
    return this.workerFailCounts.get(queueId)?.get(profileIndex) ?? 0;
  }

  clearWorkerFailures(queueId: number): void {
    this.workerFailCounts.delete(queueId);
  }

  /** 当前 worker 对本任务的失败是否已达改派阈值 */
  shouldReassign(queueId: number, profileIndex: number): boolean {
    return this.getWorkerFailureCount(queueId, profileIndex) >= this.maxWorkerFailures;
  }

  /**
   * 调用 auto-vi 改派接口：排除当前 profile，退回 pending，清空 worker 绑定。
   */
  async reassignToOtherWorker(
    queueItem: RemoteTaskQueue,
    fromProfileIndex: number,
    errorMessage: string,
  ): Promise<ReassignResult> {
    const { queueId, taskId } = queueItem;
    const failCount = this.getWorkerFailureCount(queueId, fromProfileIndex);
    const message = `[scheduler] worker-${fromProfileIndex} 连续失败 ${failCount} 次已排除 | ${errorMessage}`;

    const { data: response } = await firstValueFrom(
      this.httpService.post(
        `${this.autoViApiUrl}/api/tasks-queue/${queueId}/reassign`,
        {
          fromProfileIndex,
          errorMessage: message,
          maxBrowsers: this.maxBrowsers,
        },
      ),
    );

    const payload = response.data as {
      reassigned: boolean;
      queue?: { excludedWorkers?: string };
    };

    // 改派成功后清掉该任务的内存失败计数，让新 worker 从 0 开始
    this.clearWorkerFailures(queueId);

    if (payload?.reassigned) {
      this.logger.warn(
        `[scheduler] 任务 ${taskId} 已从 worker-${fromProfileIndex} 改派，排除列表=${payload.queue?.excludedWorkers ?? '[]'}`,
      );
      return { reassigned: true, errorMessage: message };
    }

    this.logger.error(
      `[scheduler] 任务 ${taskId} 所有 worker 均已排除，标记失败`,
    );
    return { reassigned: false, errorMessage: message };
  }
}
