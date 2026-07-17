import { message } from "@/utils/message";
import type { PaginationProps } from "@pureadmin/table";
import { addDialog } from "@/components/ReDialog";
import { reactive, ref, toRaw, h, computed } from "vue";
import { useColumns } from "./columns";
import { addTask, getTaskList, deleteTask, regenerateTask } from "@/api/task";
import { resolveUploadPaths } from "@/api/upload";
import { FormItemProps } from "./types";
import { deviceDetection } from "@pureadmin/utils";
import editForm from "./form.vue";
import type { UploadFile } from "element-plus";
import {
  downloadImportTemplate,
  exportTasksToXlsx,
  parseImportWorkbook,
  resolveImportRowImagePaths,
  readFileAsArrayBuffer,
  toImportImageUrl
} from "./excel";

const { columns, statusButtonMap, statusColorMap, statusMap } = useColumns();

export function useTask() {
  const dataList = ref([]);
  const formRef = ref();
  const form = reactive({
    taskId: "",
    status: "",
    productId: "",
    promptText: ""
  });
  const loading = ref(true);
  const exportLoading = ref(false);
  const importLoading = ref(false);
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    background: true
  });
  const sort = reactive({
    sortField: 'createdAt' as 'taskId' | 'createdAt',
    sortOrder: 'desc' as 'asc' | 'desc'
  });
  const statusOptions = computed(() => {
    return Object.entries(statusMap).map(([key, value]) => ({
      label: value,
      value: key
    }));
  });

  async function onSearch() {
    loading.value = true;
    const { code, data } = await getTaskList({
      ...toRaw(form),
      ...toRaw(sort),
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
    onSearch();
  };


  function openDialog(title = "新增", row?: FormItemProps) {
    console.log("row", row);
    const imageList = row?.assets?.map(item => ({
      url: item?.assetPath,
      name: item?.assetId
    })) ?? [];
    addDialog({
      title: `${title}任务`,
      props: {
        formInline: {
          taskId: row?.taskId ?? "",
          status: row?.status ?? "",
          imageList: imageList,
          productId: row?.productId ?? "",
          promptText: row?.promptText ?? "",
          duration: row?.duration ?? 10
        }
      },
      width: "40%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef, formInline: null, type: title === "新增" ? "add" : "edit" }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;
        function chores() {
          message(`您${title}了提示词为${curData.promptText}的这条数据`, {
            type: "success"
          });
          done(); // 关闭弹框
          onSearch(); // 刷新表格数据
        }
        FormRef.validate(async valid => {
          if (valid) {
            console.log("curData", curData);
            const reqData = {
              productId: curData.productId,
              promptText: curData.promptText,
              duration: curData.duration,
              imageList: curData.imageList.map(item => {
                if (item && item?.response && item?.response?.data) {
                  return item?.response?.data?.urls[0];
                } else {
                  return item?.url;
                }
              }),
            };
            // 表单规则校验通过
            if (title === "新增") {
              // 实际开发先调用新增接口，再进行下面操作
              const { code, data, message: msg } = await addTask(reqData);
              if (code === 200) {
                chores();
              } else {
                message(msg, { type: "error" });
              }
            } else {
              // 实际开发先调用修改接口，再进行下面操作
              chores();
            }
          }
        });
      }
    });
  }

  function handleDownloadTemplate() {
    downloadImportTemplate();
  }

  async function handleExport() {
    exportLoading.value = true;
    try {
      const { code, data, message: msg } = await getTaskList({
        ...toRaw(form),
        ...toRaw(sort),
        currentPage: 1,
        pageSize: Math.max(pagination.total, 1)
      });
      if (code !== 200) {
        message(msg || "导出失败", { type: "error" });
        return;
      }
      exportTasksToXlsx(data.list ?? [], statusMap);
      message("导出成功", { type: "success" });
    } catch {
      message("导出失败", { type: "error" });
    } finally {
      exportLoading.value = false;
    }
  }

  async function handleImportFile(uploadFile: UploadFile) {
    const file = uploadFile.raw;
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      message("请上传 .xlsx 格式的 Excel 文件", { type: "error" });
      return;
    }

    importLoading.value = true;
    try {
      const buffer = await readFileAsArrayBuffer(file);
      const { rows, errors } = parseImportWorkbook(buffer);
      if (errors.length) {
        message(errors.slice(0, 5).join("；"), { type: "error" });
        return;
      }

      const resolved = await resolveImportRowImagePaths(rows, async paths => {
        const { code, data, message: msg } = await resolveUploadPaths(paths);
        if (code !== 200 || !data?.results) {
          throw new Error(msg || "图片路径解析失败");
        }
        return data.results;
      });

      if (resolved.errors.length) {
        message(resolved.errors.slice(0, 5).join("、"), { type: "error" });
        return;
      }

      let successCount = 0;
      const failMessages: string[] = [];

      for (const row of resolved.rows) {
        const { code, message: msg } = await addTask({
          promptText: row.promptText,
          imageList: row.imageList.map(toImportImageUrl),
          duration: row.duration,
          productId: ""
        });
        if (code === 200) {
          successCount++;
        } else {
          failMessages.push(msg || "导入失败");
        }
      }

      if (successCount > 0) {
        await onSearch();
      }

      if (failMessages.length === 0) {
        message("导入成功，共 " + successCount + " 条", { type: "success" });
      } else if (successCount === 0) {
        message(failMessages[0] || "导入失败", { type: "error" });
      } else {
        message(
          "部分导入成功：成功 " + successCount + " 条，失败 " + failMessages.length + " 条",
          { type: "warning" }
        );
      }
    } catch {
      message("读取或解析 Excel 失败", { type: "error" });
    } finally {
      importLoading.value = false;
    }
  }
  async function handleRegenerate(row) {
    const { code, message: msg } = await regenerateTask(row.taskId);
    if (code === 200) {
      message(msg || "任务已重置，等待重新生成", { type: "success" });
      onSearch();
    } else {
      message(msg, { type: "error" });
    }
  }

  async function handleDelete(row) {
    // message(`您删除了提示词为${row.promptText}的这条数据`, { type: "success" });
    const { code, message: msg } = await deleteTask(row.taskId);
    if (code === 200) {
      message(msg, { type: "success" });
      onSearch();
    } else {
      message(msg, { type: "error" });
    }
  }

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

  function handleSelectionChange(val) {
    console.log("handleSelectionChange", val);
  }

  function handleSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (!order) {
      sort.sortField = 'createdAt';
      sort.sortOrder = 'desc';
    } else {
      sort.sortField = prop as 'taskId' | 'createdAt';
      sort.sortOrder = order === 'ascending' ? 'asc' : 'desc';
    }
    pagination.currentPage = 1;
    onSearch();
  }


  return {
    form,
    loading,
    exportLoading,
    importLoading,
    statusOptions,
    statusButtonMap,
    statusColorMap,
    columns,
    dataList,
    pagination,
    onSearch,
    resetForm,
    openDialog,
    handleExport,
    handleDownloadTemplate,
    handleImportFile,
    handleRegenerate,
    handleDelete,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange,
    sort,
    handleSortChange
  };
}
