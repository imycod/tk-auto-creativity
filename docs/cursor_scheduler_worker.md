# Scheduler worker 轮换逻辑
_Exported on 7/24/2026 at 18:15:55 GMT+8 from Cursor (3.8.11)_

---

**User**

1. 拉取（同步）最新代码 2. scheduler 目前是如何实现的？ 有好多worker 或者 profile 或者 浏览器闲置，我说下我的需求，一开始打开浏览器在消费任务时，有可能profile 没准备好，此时我需要手动登录，此时scheduler 会指派到其它的worker 消费，是这样做的吗？ 1-10个浏览器 这个是 程序里拿 config 拿到那个最大浏览器就是多少浏览器，那么我需要轮换 就是 任务消费 worker-1 不行 就试 worker-2 这个不行 就试 worker-3 一直到 worker-10 然后还不行 继续 worker-1 worker-2 worker-3 直到 轮转了3次都不行 任务报错 需要手动重试 现在是这样吗

---

**Cursor**

先拉取最新代码，再查看 scheduler 的实现，对照你说的 worker/profile 轮换逻辑。

工作区看起来异常，我先确认目录内容和 git 状态。

网络连不上 GitHub，本地已显示与 `origin/dev` 同步。接着查 scheduler 相关实现。

继续读完整 scheduler、consumer 以及 auto-vi 的改派接口。

**1. 拉代码：** 当前在 `dev`（`7038678`），本地显示已与 `origin/dev` 一致；但连 GitHub 443 失败，这次没真正 `fetch` 到远程最新。网络好了再 `git pull` 一次更稳妥。

---

**2. 现在 scheduler 不是你说的那种「轮询 3 圈」**

现状可以概括成：

| 你的预期 | 当前实现 |
|---------|---------|
| 1–10 个浏览器 | `MAX_BROWSERS`，但代码里 **硬上限是 5**（`Math.min(configured, 5)`） |
| worker-1 不行 → 立刻试 worker-2 → … → 转 3 圈再失败 | **不是**；是并行 worker，每个 worker 对同一任务连续失败 **3 次** 才排除，排除后 **不再回来试** |
| 登录/profile 未就绪时改派 | **部分符合**：未登录导致 chatbox/loadState 超时属于「可改派错误」，会走改派 |

### 实际流程

1. 每 2 分钟扫 `pending` / `retrying`，启动 `min(MAX_BROWSERS, 待处理数)` 个并行 worker（`worker-0` …）。
2. claim 时跳过 `excludedWorkers` 里已排除的 profile。
3. **可改派错误**（积分不足、chatbox 超时≈未登录/页面未就绪、`waitForLoadState` 超时）  
   - 同一 worker 累计失败未满 3 → 标 `retrying`，该 worker 本轮停  
   - 满 3 次 → 调 `/reassign`，把该 profile 写入排除列表，任务退回 `pending`  
   - 其它未排除的 worker 下次可领  
4. `0..maxBrowsers-1` **全部排除** → 任务 `failed`，需手动重试。  
5. 改派成功后会清内存失败计数，**新 worker 从 0 再计 3 次**。

所以：需要手动登录时，**不会马上**指派别的 worker；当前 worker 要连挂约 3 次才会排除并改派。也 **没有**「转完一圈再从 worker-1 重来，共 3 圈」——排除过的 worker 对本任务不会再领。

若你要的是「每个 worker 试 1 次就换，最多转 3 圈，上限 10」，和现在差一截，可以说一下要不要按那个改。

---

**User**

<timestamp>Friday, Jul 24, 2026, 5:31 PM (UTC+8)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: shell
status: error
task_id: 702184
title: Pull latest with full permissions
detail: exit_code=1
output_path: C:\Users\Administrator\.cursor\projects\c-Users-Administrator-Desktop-workspace-vi-system\terminals\702184.txt
</task>
</system_notification>
<user_query>Briefly inform the user about the task result and perform any follow-up actions (if needed). If there's no follow-ups needed, don't explicitly say that.</user_query>

---

**Cursor**

`git pull` 没成功：连不上 `github.com:443`，本地 `dev` 仍停在 `7038678`，显示与上次已知的 `origin/dev` 一致。网络恢复后再拉一次即可。

---

**User**

当任务改派不行 那么worker 会被记录到数据库是吗？ 下次 就不会把这个 任务下发到这个worker 了吗？

---

**Cursor**

是的，记在**这条任务队列**上，不是全局禁用某个 worker。

改派时会把当前 `fromProfileIndex` 写进该条 `task_queue.excluded_workers`（JSON，如 `[0,2]`），任务退回 `pending`。之后 `claim` 会跳过已包含该 profile 的任务，所以**这条任务**不会再发给这些 worker。

若所有可用 profile 都进了排除列表，任务直接 `failed`，需要手动重试；手动重试若不清 `excluded_workers`，排除记录仍在。

---

**User**

我现在有些任务一直在pending 2天了，我怀疑 这些任务 都记录了排除 worker 因为之前某些原因 导致 的原因， 加一个功能 前端需要在任务列表里 显示 该任务 对应的 woker 是谁， 还有就是 当 创建时间 + 1天 就是往后延期一天 还是处于 pending 态 那么 就把该任务 置为  生成失败  （然后前端可以重新生成） 重新生成就重新开始  worker-1 worker-2 去消费 。 现在就是有一个问题 可改派错误（积分不足、chatbox 超时≈未登录/页面未就绪、waitForLoadState 超时）
同一 worker 累计失败未满 3 → 标 retrying，该 worker 本轮停
满 3 次 → 调 /reassign，把该 profile 写入排除列表，任务退回 pending
其它未排除的 worker 下次可领 当 worker 都失败 该任务一直pending ，但是worker 不可能都失败 所以 不该一直pending 你懂吗？ 浏览器处于空闲态， 所以假设都排除了 那么下次在消费任务时 该任务 已经排除了 这个worker 其实这个worker 是好的 所以 做一个 大的 重试 比如 3次 轮换 worker-1 worker-2 worker-3 都不行就不行

---

**Cursor**

理解：排除列表会把健康 worker 永久挡掉，任务会一直卡在 pending。先摸清任务列表、重新生成和改派相关代码，再按「展示 worker + 超时失败 + 3 轮轮换」改。

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

开始按计划实现：先修复 `regenerate` 清空排除列表，再改改派轮换与其它项。

正在改 entity、regenerate 和 reassign。

需要你批准后才能改仓库里的服务代码。

匹配失败，先核对 `regenerate` 段的实际内容。

文件是 CRLF，正在用兼容换行的方式重新打补丁。

auto-vi 主补丁已完成。接着验证，并改 tk-auto 与前端。

接着改前端任务列表与队列列表的 Worker 展示。

已按计划做完，要点如下：

**根因修复**  
「重新生成」会清空 `excludedWorkers` 和 `scheduleRound`，不再出现排除列表残留导致永远 pending。

**3 轮大重试**  
本轮所有 worker 都排除后：清空排除并 `scheduleRound++`；满 3 轮仍失败 → `failed`。`MAX_BROWSERS` 硬上限改为 10。

**超时兜底**  
每小时扫描：`pending`/`retrying` 超过 1 天，或排除列表已盖满全部 worker 却仍 pending → 自动 `failed`。

**前端**  
任务列表、队列列表展示当前 Worker、排除列表、调度轮次。

重启 `auto-vi` 后会自动补 `schedule_round` 列；对已卡住 2 天的 pending，下一小时扫描会标失败，也可手动点「重新生成」。

---

**User**

把改动 写道 docs 里

---

**Cursor**

先看现有 docs 结构，再把这次改动写进去。

