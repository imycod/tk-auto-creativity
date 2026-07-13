import { message } from "@/utils/message";
import type { PaginationProps } from "@pureadmin/table";
import { addDialog } from "@/components/ReDialog";
import { reactive, ref, toRaw, h, computed } from "vue";
import { useColumns } from "./columns";
import { addTask, getTaskList, deleteTask, regenerateTask } from "@/api/task";
import { FormItemProps } from "./types";
import { getKeyList, deviceDetection } from "@pureadmin/utils";
import editForm from "./form.vue";

const { columns, statusButtonMap, statusColorMap, statusMap } = useColumns();

export function useTask() {
  const dataList = ref([]);
  const formRef = ref();
  const form = reactive({
    taskId: "",
    status: "",
    productId: ""
  });
  const loading = ref(true);
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    background: true
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


  return {
    form,
    loading,
    statusOptions,
    statusButtonMap,
    statusColorMap,
    columns,
    dataList,
    pagination,
    onSearch,
    resetForm,
    openDialog,
    handleRegenerate,
    handleDelete,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}