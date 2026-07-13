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
  task: {
    promptText: string;
    duration?: number;
    assets: Array<{
      assetType: string;
      assetPath: string;
    }>
  }
}