// 远端 auto-vi 返回的类型简易定义
export interface RemoteTaskQueue {
  queueId: number;
  taskId: number;
  status: 'pending' | 'retrying' | 'processing' | 'submitted' | 'failed';
  stage: string;
  startedAt?: string;
  completedAt?: string;
  workerId?: string;
  profileIndex?: number;
  retryCount: number;
  errorMessage?: string;
  /** 已被调度器排除的 profile 列表 JSON，如 "[0,1]" */
  excludedWorkers?: string;
  task: {
    promptText: string;
    duration?: number;
    assets: Array<{
      assetType: string;
      assetPath: string;
    }>
  }
}