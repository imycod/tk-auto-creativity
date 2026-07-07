<script setup lang="ts">
import { onMounted, ref, reactive } from "vue";
import { initRouter } from "@/router/utils";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { PureTableBar } from "@/components/RePureTableBar";

import { useAssets } from "./utils/hook";

import {
  deviceDetection,
} from "@pureadmin/utils";

import Refresh from "~icons/ep/refresh";

defineOptions({ 
  name: "AssetsList"
});

const formRef = ref();
const tableRef = ref();
const { form, loading, dataList, onSearch, resetForm, handleSelectionChange, handleSizeChange, handleCurrentChange, columns, pagination } = useAssets();

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
      <el-form-item label="资产ID：" prop="assetId">
        <el-input
          v-model="form.assetId"
          placeholder="请输入资产ID"
          clearable
          class="w-45!"
        />
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
      :class="['flex', deviceDetection() ? 'flex-wrap' : '']"
    >
      <PureTableBar
        :class="['w-full']"
        style="transition: width 220ms cubic-bezier(0.4, 0, 0.2, 1)"
        title="任务管理"
        :columns="columns"
        @refresh="onSearch"
      >
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
          />
        </template>
      </PureTableBar>
    </div>
  </div>
</template>
