import { http } from "@/utils/http";

type ResultAddTask = {
  code: number;
  message: string;
  data?: {
    promptText: string;
    imageList: string[];
  };
};

type ResultTable = {
  code: number;
  message: string;
  data?: {
    /** 列表数据 */
    list: Array<any>;
    /** 总条目数 */
    total?: number;
    /** 每页显示条目个数 */
    pageSize?: number;
    /** 当前页数 */
    currentPage?: number;
  };
};

type ResultDeleteTask = {
  code: number;
  message: string;
  data?: {
    taskId: string;
  };
};

/** 获取任务列表 */
export const getTaskList = (data?: object) => {
  return http.request<ResultTable>("post", "/api/tasks/list", { data });
};

/** 新增任务 */
export const addTask = (data?: object) => {
  return http.request<ResultAddTask>("post", "/api/tasks/add", { data });
};

/** 删除任务 */
export const deleteTask = (taskId: string) => {
  return http.request<ResultDeleteTask>("delete", `/api/tasks/${taskId}`);
};

/** 重新生成任务（重置任务及关联队列表、视频状态） */
export const regenerateTask = (taskId: string | number) => {
  return http.request<{ code: number; message: string }>(
    "post",
    `/api/tasks/regenerate/${taskId}`
  );
};


/** 获取任务队列列表 */
export const getTaskQueuedList = (data?: object) => {
  return http.request<ResultTable>("post", "/api/tasks-queue", { data });
};


/** 一键下载 */
export const downloadAllApi = (): Promise<{ code: number }> => {
  return http.request<{ code: number }>("post", "/api/tasks/queued/downloadAll");
};