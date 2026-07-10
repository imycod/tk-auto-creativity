<script setup lang="ts">
import { initRouter } from "@/router/utils";
import { onMounted, ref } from "vue";

import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { PureTableBar } from "@/components/RePureTableBar";

import { useQueued } from "./utils/hook";

import {
  deviceDetection,
} from "@pureadmin/utils";

import Refresh from "~icons/ep/refresh";
import Download from "~icons/ep/download";

defineOptions({ 
  name: "AssetsList"
});

const formRef = ref();    
const tableRef = ref();
const {
  form,
  stageOptions,
  statusOptions,
  loading,
  dataList,
  onSearch,
  resetForm,
  columns,
  pagination,
  handleSizeChange,
  handleCurrentChange,
  downloadAll,
} = useQueued();

onMounted(() => {
  onSearch();
  initRouter()
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
      <el-form-item label="队列ID：" prop="queueId">
        <el-input
          v-model="form.queueId"
          placeholder="请输入队列ID"
          clearable
          class="w-45!"
        />
      </el-form-item>
      <el-form-item label="阶段：" prop="stage">
        <el-select
          v-model="form.stage"
          placeholder="请选择阶段"
          clearable
          class="w-45!"
        >
          <el-option v-for="item in stageOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
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
          @click="onSearch(true)"
        >
          搜索
        </el-button>
        <el-button :icon="useRenderIcon(Refresh)" @click="resetForm(formRef)">
          重置
        </el-button>
      </el-form-item>
    </el-form>
    <div
      :class="['flex', deviceDetection() ? 'flex-wrap' : '']"
    >
      <PureTableBar
        :class="['w-full']"
        style="transition: width 220ms cubic-bezier(0.4, 0, 0.2, 1)"
        title="任务队列管理"
        :columns="columns"
        @refresh="onSearch"
      >
        <!-- <template #buttons>
          <el-button
            type="primary"
            :icon="useRenderIcon(Download)"
            @click="downloadAll()"
          >
            一键下载
          </el-button>
        </template> -->
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
            @page-size-change="handleSizeChange"
            @page-current-change="handleCurrentChange"
          />
        </template>
      </PureTableBar>
    </div>
  </div>
</template>
