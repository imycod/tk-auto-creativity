import { ref, reactive, toRaw } from "vue";

import type { PaginationProps } from "@pureadmin/table";
import dayjs from "dayjs";
import { message } from "@/utils/message";
import { getAssetsList } from "@/api/assets";

export function useAssets() {
  const form = reactive({
    taskId: "",
    assetId: "",
  })
  const loading = ref(true);
  const dataList = ref([]);

  const assetTypeMap = {
    "image": "图片",
    "video": "视频",
    "audio": "音频",
  };
  const assetTypeIconMap = {
    "image": "ep:picture-filled",
    "video": "ep:video-camera-filled",
    "audio": "ri:soundcloud-fill",
  };

  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    background: true
  });

  const columns: TableColumnList = [
    {
      label: "资产ID",
      prop: "assetId",
    },
    {
      label: "任务ID",
      prop: "taskId",
    },
    {
      label: "资产类型",
      prop: "assetType",
      width: 100,
      cellRenderer: ({ index, row }) => (
        <div style="display: flex; align-items: center">
          <iconify-icon-online icon={assetTypeIconMap[row.assetType]} />
          <span style="margin-left: 10px">{assetTypeMap[row.assetType]}</span>
        </div>
      )
    },
    {
      label: "资产路径",
      prop: "assetPath",
      cellRenderer: ({ index, row }) => (
        <el-image
          preview-teleported
          loading="lazy"
          src={row.assetPath}
          fit="cover"
          class="size-25"
          preview-src-list={[row.assetPath]}
          initial-index={index}
        />
      )
    },
    // {
    //   label: "资产尺寸",
    //   prop: "meta",
    //   cellRenderer: ({ index, row }) => (
    //     <div style="display: flex; align-items: center">
    //       <span style="margin-left: 10px">{row.meta.width}x{row.meta.height}</span>
    //     </div>
    //   )
    // },
    {
      label: "创建时间",
      prop: "createdAt",
      formatter: (_row, _column, cellValue) =>
        cellValue ? dayjs(cellValue).format("YYYY-MM-DD HH:mm:ss") : "-",
    },
    // {
    //   label: "操作",
    //   width: 300,
    //   slot: "operation"
    // },
  ];

  function handleDelete(row) {
    message(`您删除了角色名称为${row.name}的这条数据`, { type: "success" });
    onSearch();
  }

  function handleSizeChange(val: number) {
    pagination.pageSize = val;
    onSearch();
  }

  function handleCurrentChange(val: number) {
    pagination.currentPage = val;
    onSearch();
  }

  function handleSelectionChange(val) {
    console.log("handleSelectionChange", val);
  }

  async function onSearch() {
    loading.value = true;
    const { code, data } = await getAssetsList({
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


  return {
    columns,
    pagination,
    assetTypeMap,
    assetTypeIconMap,
    form,
    loading,
    dataList,
    onSearch,
    resetForm,
    handleDelete,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange,
  };
}