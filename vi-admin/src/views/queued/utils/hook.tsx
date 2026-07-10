import { ref, reactive, toRaw, computed } from "vue";

import type { PaginationProps } from "@pureadmin/table";
import dayjs from "dayjs";
import { message } from "@/utils/message";
import { getTaskQueuedList, downloadAllApi } from "@/api/task";

export function useQueued() {
  const form = reactive({
    taskId: "",
    queueId: "",
    stage: "",
    status: "",
  })
  const loading = ref(true);
  const dataList = ref([]);

  const statusMap = {
    "pending": "待生成",
    "processing": "生成中",
    "completed": "下载完毕",
    "failed": "生成失败",
    "retrying": "重试中",
    "submitted": "已提交正在生成",
    // "cancelled": "已取消",
    // "interrupted": "已中断",
    // "timeout": "已超时",
  };
  const statusColorMap = {
    "pending": "primary",
    "processing": "warning",
    "completed": "success",
    "failed": "danger",
    "retrying": "warning",
    "cancelled": "danger",
    "submitted": "warning",
    "interrupted": "danger",
    "timeout": "danger",
  };


  const stageMap = {
    "init": "初始化",
    "preprocess": "预处理中",
    "rendering": "渲染中",
    "postprocess": "后处理中",
  };
  const stageColorMap = {
    "init": "primary",
    "preprocess": "warning",
    "rendering": "warning",
    "postprocess": "warning",
  };

  const stageOptions = computed(() => {
    return Object.entries(stageMap).map(([key, value]) => ({
      label: value,
      value: key
    }));
  });
  const statusOptions = computed(() => {
    return Object.entries(statusMap).map(([key, value]) => ({
      label: value,
      value: key
    }));
  });

  const columns: TableColumnList = [
    {
      label: "任务ID",
      prop: "taskId",
    },
    {
      label: "队列ID",
      prop: "queueId",
    },
    {
      label: "阶段",
      prop: "stage",
      cellRenderer: ({ index, row }) => (
        <el-tag type={stageColorMap[row.stage]}>{stageMap[row.stage]}</el-tag>
      )
    },
    {
      label: "状态",
      prop: "status",
      cellRenderer: ({ index, row }) => (
        <el-tag type={statusColorMap[row.status]}>{statusMap[row.status]}</el-tag>
      )
    },
    {
      label: "重试次数",
      prop: "retryCount",
      width: 100,
    },
    {
      label: "错误信息",
      prop: "errorMessage",
      width: 200,
      // cellRenderer: ({ index, row }) => (
      //   <el-tooltip content={row.errorMessage} placement="top">
      //     <span class="line-clamp-1" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{row.errorMessage}</span>
      //   </el-tooltip>
      // )
    },
    {
      label: "开始时间",
      prop: "startedAt",
      formatter: (_row, _column, cellValue) =>
        cellValue ? dayjs(cellValue).format("YYYY-MM-DD HH:mm:ss") : "-",
    },
    {
      label: "创建时间",
      prop: "createdAt",
      formatter: (_row, _column, cellValue) =>
        cellValue ? dayjs(cellValue).format("YYYY-MM-DD HH:mm:ss") : "-",
    },
    {
      label: "完成时间",
      prop: "completedAt",
      formatter: (_row, _column, cellValue) =>
        cellValue ? dayjs(cellValue).format("YYYY-MM-DD HH:mm:ss") : "-",
    }
  ]

  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    background: true
  });

  async function onSearch(resetPage = false) {
    if (resetPage) {
      pagination.currentPage = 1;
    }
    loading.value = true;
    const { code, data } = await getTaskQueuedList({
      ...toRaw(form),
      currentPage: pagination.currentPage,
      pageSize: pagination.pageSize
    });
    if (code === 200) {
      dataList.value = data.list;
      pagination.total = data.total;
      pagination.pageSize = data.pageSize;
      pagination.currentPage = data.currentPage;
    }

    setTimeout(() => {
      loading.value = false;
    }, 500);
  }

  const resetForm = formEl => {
    if (!formEl) return;
    formEl.resetFields();
    onSearch(true);
  };

  function handleSizeChange(val: number) {
    console.log(`${val} items per page`);
    pagination.pageSize = val;
    onSearch();
  }

  function handleCurrentChange(val: number) {
    pagination.currentPage = val;
    onSearch();
    console.log(`current page: ${val}`);
  }

  async function downloadAll() {
    const { code } = await downloadAllApi();
    if (code === 200) {
      message("下载成功", { type: "success" });
    }
  }

  return {
    form,
    stageOptions,
    statusOptions,
    loading,
    dataList,
    columns,
    pagination,
    onSearch,
    resetForm,
    handleSizeChange,
    handleCurrentChange,
    downloadAll,
  }
}