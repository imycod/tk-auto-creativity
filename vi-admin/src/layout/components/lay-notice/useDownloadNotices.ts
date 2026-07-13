import { onMounted, onUnmounted, ref, type Ref } from "vue";
import dayjs from "dayjs";
import { getTaskList } from "@/api/task";
import type { ListItem, TabItem } from "./data";

const POLL_INTERVAL_MS = 60 * 1000;
const STORAGE_KEY = "vi-admin-download-notice-since";
const SEEN_KEY = "vi-admin-download-notice-seen";
const MAX_NOTICES = 50;

function loadSeenIds(): Set<number> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<number>) {
  sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
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

/** 轮询已完成任务，在 downloader 下载完成后推送通知 */
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

    const seen = loadSeenIds();
    const fresh = tasks.filter(task => !seen.has(task.taskId));
    if (!fresh.length) return;

    const newItems = fresh.map(taskToNotice);
    tab.list = [...newItems, ...tab.list].slice(0, MAX_NOTICES);
    fresh.forEach(task => seen.add(task.taskId));
    saveSeenIds(seen);
    syncBadge();
  };

  const advanceSince = (list: Array<{ updatedAt?: string }>) => {
    const latest = list.map(item => item.updatedAt).filter(Boolean).sort().pop();
    sessionStorage.setItem(
      STORAGE_KEY,
      latest ? new Date(latest).toISOString() : new Date().toISOString()
    );
  };

  const poll = async () => {
    if (polling) return;
    polling = true;
    try {
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
        advanceSince(data.list);
      } else {
        sessionStorage.setItem(STORAGE_KEY, new Date().toISOString());
      }
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
    syncBadge();
    void poll();
    timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
  });

  onUnmounted(() => {
    if (timer) clearInterval(timer);
  });

  return { noticesNum, syncBadge };
}
