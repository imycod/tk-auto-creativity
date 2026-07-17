<script setup lang="ts">
import { ref, computed, nextTick, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import { initRouter, getTopMenu } from "@/router/utils";
import { getTaskList } from "@/api/task";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { useTask } from "./hook";
const router = useRouter();

import {
  delay,
  subBefore,
  deviceDetection,
  useResizeObserver
} from "@pureadmin/utils";

import Delete from "~icons/ep/delete";
import EditPen from "~icons/ep/edit-pen";
import Refresh from "~icons/ep/refresh";
import Menu from "~icons/ep/menu";
import AddFill from "~icons/ri/add-circle-line";
import Close from "~icons/ep/close";
import Check from "~icons/ep/check";

defineOptions({
  name: "Welcome"
});

const iconClass = computed(() => {
  return [
    "size-5.5",
    "flex-c",
    "outline-hidden",
    "rounded-sm",
    "cursor-pointer",
    "transition-colors",
    "hover:bg-[#0000000f]",
    "dark:hover:bg-[#ffffff1f]",
    "dark:hover:text-[#ffffffd9]"
  ];
});

const formRef = ref();
const tableRef = ref();
const contentRef = ref();

const {
  form,
  loading,
  statusButtonMap,
  statusOptions,
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
} = useTask();

onMounted(() => {
  onSearch();
  initRouter().then(() => {
    router
      .push(getTopMenu(true).path)
      .then(() => {
        console.log("登录成功");
      })
  });
});
</script>

<template>
  <div class="main">
    <el-form
      ref="formRef"
      :inline="true"
      :model="form"
      class="search-form bg-bg_color w-full pl-8 pt-3 overflow-auto"
    >
      <el-form-item label="任务ID：" prop="taskId">
        <el-input
          v-model="form.taskId"
          placeholder="请输入任务ID"
          clearable
          class="w-45!"
        />
      </el-form-item>
      <el-form-item label="产品ID：" prop="productId">
        <el-input
          v-model="form.productId"
          placeholder="请输入产品ID"
          clearable
          class="w-45!"
        />
      </el-form-item>

      <el-form-item label="提示词：" prop="promptText">
        <el-input
          v-model="form.promptText"
          placeholder="请输入提示词关键词"
          clearable
          class="w-45!"
        />
      </el-form-item>
      <el-form-item label="状态：" prop="status">
        <el-select
          v-model="form.status"
          placeholder="请选择状态"
          clearable
          class="w-45!"
        >
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          :icon="useRenderIcon('ri/search-line')"
          :loading="loading"
          @click="onSearch"
        >
          搜索
        </el-button>
        <el-button :icon="useRenderIcon(Refresh)" @click="resetForm(formRef)">
          重置
        </el-button>
      </el-form-item>
    </el-form>

    <div
      ref="contentRef"
      :class="['flex', deviceDetection() ? 'flex-wrap' : '']"
    >
      <PureTableBar
        :class="['w-full']"
        style="transition: width 220ms cubic-bezier(0.4, 0, 0.2, 1)"
        title="任务管理"
        :columns="columns"
        @refresh="onSearch"
      >
        <template #buttons>
          <el-button
            type="primary"
            :icon="useRenderIcon(AddFill)"
            @click="openDialog()"
          >
            新增任务
          </el-button>
        </template>
        <template v-slot="{ size, dynamicColumns }">
          <pure-table
            ref="tableRef"
            align-whole="center"
            table-layout="auto"
            :loading="loading"
            :size="size"
            adaptive
            :adaptiveConfig="{ offsetBottom: 108 }"
            :data="dataList"
            :columns="dynamicColumns"
            :pagination="{ ...pagination, size }"
            :header-cell-style="{
              background: 'var(--el-fill-color-light)',
              color: 'var(--el-text-color-primary)'
            }"
            @selection-change="handleSelectionChange"
            @page-size-change="handleSizeChange"
            @page-current-change="handleCurrentChange"
          >
            <template #operation="{ row }">
              <el-button v-if="false" link :icon="useRenderIcon(Menu)" :type="statusColorMap[row.status]" :size="size">
                {{ statusButtonMap[row.status] }}
              </el-button>
              <el-button
                v-if="false"
                class="reset-margin"
                link
                type="primary"
                :size="size"
                :icon="useRenderIcon(EditPen)"
                @click="openDialog('修改', row)"
              >
                修改
              </el-button>
              <el-popconfirm
                v-if="row.status !== 'pending'"
                :title="`确认重新生成任务 ${row.taskId}？将重置任务及队列状态并清除已生成视频记录`"
                @confirm="handleRegenerate(row)"
              >
                <template #reference>
                  <el-button
                    class="reset-margin"
                    link
                    type="warning"
                    :size="size"
                    :icon="useRenderIcon(Refresh)"
                  >
                    重新生成
                  </el-button>
                </template>
              </el-popconfirm>
              <el-popconfirm
                :title="`是否确认删除任务 ${row.taskId}`"
                @confirm="handleDelete(row)"
              >
                <template #reference>
                  <el-button
                    class="reset-margin"
                    link
                    type="primary"
                    :size="size"
                    :icon="useRenderIcon(Delete)"
                  >
                    删除
                  </el-button>
                </template>
              </el-popconfirm>
            </template>
          </pure-table>
        </template>
      </PureTableBar>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-dropdown-menu__item i) {
  margin: 0;
}

.main-content {
  margin: 24px 24px 0 !important;
}

.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}
</style>