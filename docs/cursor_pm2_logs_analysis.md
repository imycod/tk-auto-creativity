# PM2 logs analysis
_Exported on 7/25/2026 at 09:59:48 GMT+8 from Cursor (3.8.11)_

---

**User**

PS C:\Users\admin> pm2 logs
[TAILING] Tailing last 15 lines for [all] processes (change the value with --lines option)
C:\Users\admin\.pm2\pm2.log last 15 lines:
PM2        | 2026-07-25T09:13:18: PM2 log: Stopping app:tk-auto id:0
PM2        | 2026-07-25T09:13:18: PM2 log: App [tk-auto:0] exited with code [1] via signal [SIGINT]
PM2        | 2026-07-25T09:13:19: PM2 log: pid=6300 msg=process tree killed (1 pids)
PM2        | 2026-07-25T09:14:02: PM2 log: App [tk-auto:0] starting in -fork mode-
PM2        | 2026-07-25T09:14:02: PM2 log: App [tk-auto:0] online
PM2        | 2026-07-25T09:14:08: PM2 log: Stopping app:tk-auto id:0
PM2        | 2026-07-25T09:14:08: PM2 log: App [tk-auto:0] exited with code [1] via signal [SIGINT]
PM2        | 2026-07-25T09:14:08: PM2 log: pid=8436 msg=process tree killed (1 pids)
PM2        | 2026-07-25T09:14:25: PM2 log: App [tk-auto:0] starting in -fork mode-
PM2        | 2026-07-25T09:14:25: PM2 log: App [tk-auto:0] online
PM2        | 2026-07-25T09:15:18: PM2 log: Stopping app:tk-auto id:0
PM2        | 2026-07-25T09:15:18: PM2 log: App [tk-auto:0] exited with code [1] via signal [SIGINT]
PM2        | 2026-07-25T09:15:18: PM2 log: pid=22336 msg=process tree killed (1 pids)
PM2        | 2026-07-25T09:15:27: PM2 log: App [tk-auto:0] starting in -fork mode-
PM2        | 2026-07-25T09:15:27: PM2 log: App [tk-auto:0] online

C:\Users\admin\.pm2\logs\tk-auto-error.log last 15 lines:
0|tk-auto  |   "domcontentloaded" event fired
0|tk-auto  |   "load" event fired
0|tk-auto  | ============================================================
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:26:02   ERROR [DownloaderService] [downloader-7] 打开下载页面失败: page.waitForLoadState: Timeout 30000ms exceeded.
0|tk-auto  | =========================== logs ===========================
0|tk-auto  |   "commit" event fired
0|tk-auto  |   "domcontentloaded" event fired
0|tk-auto  |   "load" event fired
0|tk-auto  | ============================================================
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:26:03   ERROR [DownloaderService] [downloader-6] 打开下载页面失败: page.waitForLoadState: Timeout 30000ms exceeded.
0|tk-auto  | =========================== logs ===========================
0|tk-auto  |   "commit" event fired
0|tk-auto  |   "domcontentloaded" event fired
0|tk-auto  |   "load" event fired
0|tk-auto  | ============================================================

C:\Users\admin\.pm2\logs\tk-auto-out.log last 15 lines:
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:25:31     LOG [DownloaderService] [downloader-4] 任务 160 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:25:33     LOG [DownloaderService] [downloader-2] 任务 159 下载完成: \\192.168.50.100\AI素材\tk-auto\task_159.mp4
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:25:33     LOG [DownloaderService] [downloader-2] 任务 162 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:25:33     LOG [DownloaderService] [downloader-2] 任务 166 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:25:50     LOG [DownloaderService] [downloader-0] 任务 47 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:25:50     LOG [DownloaderService] [downloader-0] 任务 55 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:25:50     LOG [DownloaderService] [downloader-0] 任务 60 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:27:28     LOG [ConsumerService] 开始轮询任务队列...
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:27:28     LOG [ConsumerService] 暂无待处理任务
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:29:28     LOG [ConsumerService] 开始轮询任务队列...
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:29:28     LOG [ConsumerService] 暂无待处理任务
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:31:28     LOG [ConsumerService] 开始轮询任务队列...
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:31:28     LOG [ConsumerService] 暂无待处理任务
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:33:28     LOG [ConsumerService] 开始轮询任务队列...
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:33:28     LOG [ConsumerService] 暂无待处理任务

0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:28     LOG [DownloaderService] 发现 22 条待下载任务，涉及 8 个浏览器
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:28   DEBUG [BrowserService] 复用已有标签页
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:28   DEBUG [BrowserService] 复用已有标签页
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:28   DEBUG [BrowserService] 复用已有标签页
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:28   DEBUG [BrowserService] 复用已有标签页
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:28   DEBUG [BrowserService] 复用已有标签页
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:28   DEBUG [BrowserService] 复用已有标签页
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:28   DEBUG [BrowserService] 复用已有标签页
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:28   DEBUG [BrowserService] 复用已有标签页
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:28     LOG [ConsumerService] 开始轮询任务队列...
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:28     LOG [ConsumerService] 暂无待处理任务
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:28     LOG [DownloaderService] [downloader-0] 任务 47 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:28     LOG [DownloaderService] [downloader-3] 任务 50 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:28     LOG [DownloaderService] [downloader-4] 任务 51 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:29     LOG [DownloaderService] [downloader-0] 任务 55 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:29     LOG [DownloaderService] [downloader-3] 任务 56 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:29     LOG [DownloaderService] [downloader-0] 任务 60 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:29     LOG [DownloaderService] [downloader-3] 任务 64 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:34     LOG [DownloaderService] [downloader-2] 任务 162 下载完成: \\192.168.50.100\AI素材\tk-auto\task_162.mp4
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:34     LOG [DownloaderService] [downloader-4] 任务 158 下载完成: \\192.168.50.100\AI素材\tk-auto\task_158.mp4
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:34     LOG [DownloaderService] [downloader-2] 任务 166 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:35     LOG [DownloaderService] [downloader-5] 任务 161 下载完成: \\192.168.50.100\AI素材\tk-auto\task_161.mp4
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:36     LOG [DownloaderService] [downloader-4] 任务 160 下载完成: \\192.168.50.100\AI素材\tk-auto\task_160.mp4
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:39     LOG [DownloaderService] [downloader-5] 任务 163 下载完成: \\192.168.50.100\AI素材\tk-auto\task_163.mp4
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:35:41     LOG [DownloaderService] [downloader-5] 任务 164 下载完成: \\192.168.50.100\AI素材\tk-auto\task_164.mp4
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:36:00   ERROR [DownloaderService] [downloader-7] 打开下载页面失败: page.waitForLoadState: Timeout 30000ms exceeded.
0|tk-auto  | =========================== logs ===========================
0|tk-auto  |   "commit" event fired
0|tk-auto  |   "domcontentloaded" event fired
0|tk-auto  |   "load" event fired
0|tk-auto  | ============================================================
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:36:01   ERROR [DownloaderService] [downloader-6] 打开下载页面失败: page.waitForLoadState: Timeout 30000ms exceeded.
0|tk-auto  | =========================== logs ===========================
0|tk-auto  |   "commit" event fired
0|tk-auto  |   "domcontentloaded" event fired
0|tk-auto  |   "load" event fired
0|tk-auto  | ============================================================
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:36:04   ERROR [DownloaderService] [downloader-8] 打开下载页面失败: page.waitForLoadState: Timeout 30000ms exceeded.
0|tk-auto  | =========================== logs ===========================
0|tk-auto  |   "commit" event fired
0|tk-auto  |   "domcontentloaded" event fired
0|tk-auto  |   "load" event fired
0|tk-auto  | ============================================================
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:37:28     LOG [ConsumerService] 开始轮询任务队列...
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:37:28     LOG [ConsumerService] 暂无待处理任务
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:39:28     LOG [ConsumerService] 开始轮询任务队列...
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:39:28     LOG [ConsumerService] 暂无待处理任务
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:41:28     LOG [ConsumerService] 开始轮询任务队列...
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:41:28     LOG [ConsumerService] 暂无待处理任务
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:43:28     LOG [ConsumerService] 开始轮询任务队列...
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:43:28     LOG [ConsumerService] 获取到 1 条待处理任务，启动 1 个浏览器并行消费
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:45:28     LOG [DownloaderService] 发现 15 条待下载任务，涉及 6 个浏览器
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:45:28   DEBUG [BrowserService] 复用已有标签页
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:45:28   DEBUG [BrowserService] 复用已有标签页
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:45:28   DEBUG [BrowserService] 复用已有标签页
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:45:28   DEBUG [BrowserService] 复用已有标签页
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:45:28   DEBUG [BrowserService] 复用已有标签页
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:45:28   DEBUG [BrowserService] 复用已有标签页
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:45:28     LOG [ConsumerService] 开始轮询任务队列...
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:45:28     LOG [ConsumerService] 获取到 1 条待处理任务，启动 1 个浏览器并行消费
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:45:28     LOG [DownloaderService] [downloader-0] 任务 47 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:45:28     LOG [DownloaderService] [downloader-3] 任务 50 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:45:28     LOG [DownloaderService] [downloader-4] 任务 51 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:45:28     LOG [DownloaderService] [downloader-0] 任务 55 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:45:29     LOG [DownloaderService] [downloader-3] 任务 56 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:45:29     LOG [DownloaderService] [downloader-0] 任务 60 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:45:29     LOG [DownloaderService] [downloader-3] 任务 64 对应视频块未找到或尚未生成完成，稍后重试
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:46:02   ERROR [DownloaderService] [downloader-7] 打开下载页面失败: page.waitForLoadState: Timeout 30000ms exceeded.
0|tk-auto  | =========================== logs ===========================
0|tk-auto  |   "commit" event fired
0|tk-auto  |   "domcontentloaded" event fired
0|tk-auto  |   "load" event fired
0|tk-auto  | ============================================================
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:46:03   ERROR [DownloaderService] [downloader-6] 打开下载页面失败: page.waitForLoadState: Timeout 30000ms exceeded.
0|tk-auto  | =========================== logs ===========================
0|tk-auto  |   "commit" event fired
0|tk-auto  |   "domcontentloaded" event fired
0|tk-auto  |   "load" event fired
0|tk-auto  | ============================================================
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:46:03   ERROR [DownloaderService] [downloader-8] 打开下载页面失败: page.waitForLoadState: Timeout 30000ms exceeded.
0|tk-auto  | =========================== logs ===========================
0|tk-auto  |   "commit" event fired
0|tk-auto  |   "domcontentloaded" event fired
0|tk-auto  |   "load" event fired
0|tk-auto  | ============================================================
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:47:28     LOG [ConsumerService] 开始轮询任务队列...
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:47:28     LOG [ConsumerService] 获取到 1 条待处理任务，启动 1 个浏览器并行消费
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:49:28     LOG [ConsumerService] 开始轮询任务队列...
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:49:28     LOG [ConsumerService] 获取到 1 条待处理任务，启动 1 个浏览器并行消费
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:51:28     LOG [ConsumerService] 开始轮询任务队列...
0|tk-auto  | [Nest] 18280  - 2026/07/25 09:51:28     LOG [ConsumerService] 获取到 1 条待处理任务，启动 1 个浏览器并行消费 从日志可以看出，有5个浏览器 是就绪的，任务重试后为何 还是pending  日志 提示 ConsumerService 获取1条待处理 启动 1个浏览器， 浏览起开着的时候 可以直接分配worker-1 到 worker-n 麻， 上面 DownloaderService 打开下载页面失败: page.waitForLoadState 可以不用管 因为  6 7 8 我都没有登录

---

**Cursor**

从日志看：Consumer 每次只拿 1 条待处理并只启 1 个浏览器；我先对照调度与 worker 分配逻辑，查清重试后仍 pending 的原因。

日志里 `pendingCount=1` 所以只启了 1 个 worker；接着看 claim 是否按 `excludedWorkers`/`profileIndex` 过滤，以及重试后为何仍只有 1 条可领。

根因已定位：`pendingCount=1` 时只会启动 `worker-0`；若该任务已排除 profile 0，其它 worker 根本不会被拉起，任务会一直 pending。正在改成有待处理任务时启动全部可用 worker。

**结论：不是 5 个浏览器“没就绪”，而是调度只按任务数启 worker，改派后容易卡死。**

### 原因

日志这句是字面意思：

`获取到 1 条待处理任务，启动 1 个浏览器并行消费`

旧逻辑是：

```ts
workerCount = Math.min(maxBrowsers, pendingCount)
```

只有 1 条 `pending/retrying` 时，**永远只启动 `worker-0`**。

改派流程是：`worker-0` 连续失败 3 次 → 写入 `excludedWorkers: [0]` → 退回 `pending`。  
下轮仍只有 1 条任务 → 还是只启 `worker-0` → claim 发现自己已被排除 → 直接返回 null → **任务一直 pending**，`worker-1..4` 根本不会被拉起。

claim 本身已经支持“浏览器开着就分给任意未排除的 worker”（按 `excludedWorkers` / 并发槽过滤），缺的是**把其它 worker 拉进本轮**。

### 已改

有待处理任务时改为始终启动全部 `maxBrowsers` 个 worker（默认 5）：

- `worker-0` 被排除 → 领不到，立刻退出  
- `worker-1..n` 正常 claim 并处理  

Downloader 6/7/8 的 `waitForLoadState` 超时可以忽略（未登录）。

重启 `tk-auto` 后，日志应变成类似：`获取到 1 条待处理任务，启动 5 个浏览器并行消费`，随后会出现 `[worker-1]` / `[worker-2]` 等开始处理的日志。

