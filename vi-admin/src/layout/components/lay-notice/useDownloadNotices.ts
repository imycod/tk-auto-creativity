import { onMounted, onUnmounted, ref, type Ref } from "vue";
import dayjs from "dayjs";
import { ElNotification } from "element-plus";
import { getTaskList } from "@/api/task";
import type { ListItem, TabItem } from "./data";

const POLL_INTERVAL_MS = 15 * 1000;
const STORAGE_KEY = "vi-admin-download-notice-since";
const SEEN_KEY = "vi-admin-download-notice-seen";
const STORAGE_KEY_FAILED = "vi-admin-failed-notice-since";
const SEEN_FAILED_KEY = "vi-admin-failed-notice-seen";
const MAX_NOTICES = 50;

function loadSeenIds(storageKey: string): Set<number> {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function saveSeenIds(storageKey: string, ids: Set<number>) {
  sessionStorage.setItem(storageKey, JSON.stringify([...ids]));
}

function truncate(text: string, max = 80) {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}...` : t;
}

function taskToNotice(task: {
  taskId: number;
  promptText?: string;
  productId?: string;
  updatedAt?: string;
}): ListItem {
  return {
    taskId: task.taskId,
    avatar: "",
    title: `任务 #${task.taskId} 视频已下载完成`,
    datetime: task.updatedAt
      ? dayjs(task.updatedAt).format("YYYY-MM-DD HH:mm:ss")
      : dayjs().format("YYYY-MM-DD HH:mm:ss"),
    type: "下载完成",
    description: truncate(task.promptText ?? ""),
    status: "success",
    extra: "完成"
  };
}

function taskToFailedNotice(task: {
  taskId: number;
  promptText?: string;
  productId?: string;
  updatedAt?: string;
}): ListItem {
  return {
    taskId: task.taskId,
    avatar: "",
    title: `任务 #${task.taskId} 出错了`,
    datetime: task.updatedAt
      ? dayjs(task.updatedAt).format("YYYY-MM-DD HH:mm:ss")
      : dayjs().format("YYYY-MM-DD HH:mm:ss"),
    type: "任务失败",
    description: truncate(task.promptText ?? ""),
    status: "danger",
    extra: "失败"
  };
}

/** 轮询已完成与失败任务，在 downloader 下载完成或任务失败后推送通知 */
export function useDownloadNotices(notices: Ref<TabItem[]>) {
  const noticesNum = ref(0);
  let timer: ReturnType<typeof setInterval> | null = null;
  let polling = false;

  const syncBadge = () => {
    noticesNum.value = notices.value.reduce((sum, tab) => sum + tab.list.length, 0);
  };

  const appendNotices = (tasks: Array<{ taskId: number; promptText?: string; productId?: string; updatedAt?: string }>) => {
    if (!tasks.length) return;
    const tab = notices.value.find(item => item.key === "1");
    if (!tab) return;

    const seen = loadSeenIds(SEEN_KEY);
    const fresh = tasks.filter(task => !seen.has(task.taskId));
    if (!fresh.length) return;

    const newItems = fresh.map(taskToNotice);
    tab.list = [...newItems, ...tab.list].slice(0, MAX_NOTICES);
    fresh.forEach(task => {
      seen.add(task.taskId);
      ElNotification.success({
        title: "下载完成",
        message: `任务 #${task.taskId} 视频已下载完成`
      });
    });
    saveSeenIds(SEEN_KEY, seen);
    syncBadge();
  };

  const appendFailedNotices = (tasks: Array<{ taskId: number; promptText?: string; productId?: string; updatedAt?: string }>) => {
    if (!tasks.length) return;
    const tab = notices.value.find(item => item.key === "1");
    if (!tab) return;

    const seen = loadSeenIds(SEEN_FAILED_KEY);
    const fresh = tasks.filter(task => !seen.has(task.taskId));
    if (!fresh.length) return;

    const newItems = fresh.map(taskToFailedNotice);
    tab.list = [...newItems, ...tab.list].slice(0, MAX_NOTICES);
    fresh.forEach(task => {
      seen.add(task.taskId);
      const prompt = truncate(task.promptText ?? "", 120);
      ElNotification.error({
        title: "任务出错了",
        message: prompt
          ? `任务 #${task.taskId} 失败：${prompt}`
          : `任务 #${task.taskId} 执行失败，请查看任务详情`
      });
    });
    saveSeenIds(SEEN_FAILED_KEY, seen);
    syncBadge();
  };

  const advanceSince = (storageKey: string, list: Array<{ updatedAt?: string }>) => {
    const latest = list.map(item => item.updatedAt).filter(Boolean).sort().pop();
    sessionStorage.setItem(
      storageKey,
      latest ? new Date(latest).toISOString() : new Date().toISOString()
    );
  };

  const pollCompleted = async () => {
    const since = sessionStorage.getItem(STORAGE_KEY);
    if (!since) {
      sessionStorage.setItem(STORAGE_KEY, new Date().toISOString());
      return;
    }

    const { code, data } = await getTaskList({
      status: "completed",
      updatedSince: since,
      currentPage: 1,
      pageSize: 50
    });

    if (code !== 200) return;

    if (data?.list?.length) {
      appendNotices(data.list);
      advanceSince(STORAGE_KEY, data.list);
    }
  };

  const pollFailed = async () => {
    const sinceFailed = sessionStorage.getItem(STORAGE_KEY_FAILED);
    if (!sinceFailed) {
      sessionStorage.setItem(STORAGE_KEY_FAILED, new Date().toISOString());
      return;
    }

    const failedRes = await getTaskList({
      status: "failed",
      updatedSince: sinceFailed,
      currentPage: 1,
      pageSize: 50
    });

    if (failedRes.code !== 200) return;

    if (failedRes.data?.list?.length) {
      appendFailedNotices(failedRes.data.list);
      advanceSince(STORAGE_KEY_FAILED, failedRes.data.list);
    }
  };

  const poll = async () => {
    if (polling) return;
    polling = true;
    try {
      await Promise.all([pollCompleted(), pollFailed()]);
    } catch {
      // 轮询失败静默，下次重试
    } finally {
      polling = false;
    }
  };

  onMounted(() => {
    if (!sessionStorage.getItem(STORAGE_KEY)) {
      sessionStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
    if (!sessionStorage.getItem(STORAGE_KEY_FAILED)) {
      sessionStorage.setItem(STORAGE_KEY_FAILED, new Date().toISOString());
    }
    syncBadge();
    void poll();
    timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
  });

  onUnmounted(() => {
    if (timer) clearInterval(timer);
  });

  return { noticesNum, syncBadge };
}
