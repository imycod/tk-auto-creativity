<script setup lang="ts">
import { ref, computed } from "vue";
import { formRules } from "./rule";
import { FormProps } from "./types";
import { message } from "@/utils/message";
import { UploadFile } from "element-plus";

const VITE_UPLOAD_IMAGE_URL = import.meta.env.VITE_UPLOAD_IMAGE_URL as unknown as string;

import EpPlus from "~icons/ep/plus?width=30&height=30";
import Eye from "~icons/ri/eye-line";
import Delete from "~icons/ri/delete-bin-7-line";

/** 最多可上传的图片数量 */
const MAX_IMAGE_COUNT = 10;

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    promptText: "",
    imageList: [],
    productId: "",
    duration: 10
  }),
  type: "add"
});

const ruleFormRef = ref();
const newFormInline = ref(props.formInline);
const curOpenImgIndex = ref(0);
const dialogVisible = ref(false);

/** 预览图片地址列表 */
const previewUrlList = computed(() =>
  newFormInline.value.imageList.map(img => img.url).filter(Boolean)
);

function getRef() {
  return ruleFormRef.value;
}

/** 超出最大上传数时触发 */
const onExceed = () => {
  message(`最多上传${MAX_IMAGE_COUNT}张图片，请先删除后再上传`);
};

/** 移除上传的文件 */
const handleRemove = (file: UploadFile) => {
  const index = newFormInline.value.imageList.findIndex(
    (item) => item.uid === file.uid || item.url === file.url
  );
  if (index !== -1) {
    newFormInline.value.imageList.splice(index, 1);
  }
};

/** 上传文件前校验 */
const onBefore = file => {
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
    message("只能上传图片");
    return false;
  }
  const isExceed = file.size / 1024 / 1024 > 2;
  if (isExceed) {
    message(`单个图片大小不能超过2MB`);
    return false;
  }
};

/** 大图预览 */
const handlePictureCardPreview = (file: UploadFile) => {
  const index = previewUrlList.value.findIndex(url => url === file.url);
  curOpenImgIndex.value = index === -1 ? 0 : index;
  dialogVisible.value = true;
};


const handleUploadSuccess = (response: any, file: UploadFile) => {
 if (response?.code !== 200 || !response.data?.urls?.length) {
    message('上传响应异常', { type: 'error' });
    return;
  }
};

defineExpose({ getRef });
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRules"
    label-width="82px"
  >
    <el-form-item label="产品ID" prop="productId">
      <el-input
        v-model="newFormInline.productId"
        clearable
        placeholder="请输入产品ID"
      />
    </el-form-item>
    <el-form-item label="提示词" prop="promptText">
      <el-input
        type="textarea"
        v-model="newFormInline.promptText"
        clearable
        placeholder="请输入提示词"
        :rows="4"
      />
    </el-form-item>
    <el-form-item label="视频时长" prop="duration">
      <el-input-number
        v-model="newFormInline.duration"
        :min="4"
        :max="15"
        :step="1"
        controls-position="right"
      />
      <span class="ml-2 text-gray-500">秒（4-15）</span>
    </el-form-item>
    <el-form-item label="文件" prop="imageList">
       <el-upload
          v-model:file-list="newFormInline.imageList"
          drag
          multiple
          class="pure-upload"
          list-type="picture-card"
          accept="image/jpeg,image/png,image/gif,image/webp"
          :action="VITE_UPLOAD_IMAGE_URL"
          :limit="MAX_IMAGE_COUNT"
          :headers="{ Authorization: 'eyJhbGciOiJIUzUxMiJ9.admin' }"
          :on-exceed="onExceed"
          :before-upload="onBefore"
          :on-success="handleUploadSuccess"
          :on-remove="handleRemove"
        >
          <EpPlus class="m-auto mt-4" />
          <template #file="{ file }">
            <div
              v-if="file.status == 'ready' || file.status == 'uploading'"
              class="mt-[35%]! m-auto"
            >
              <p class="font-medium">文件上传中</p>
              <el-progress
                class="mt-2!"
                :stroke-width="2"
                :text-inside="true"
                :show-text="false"
                :percentage="file.percentage"
              />
            </div>
            <div v-else>
              <img
                class="el-upload-list__item-thumbnail select-none"
                :src="file.url"
              />
              <span
                id="pure-upload-item"
                :class="[
                  'el-upload-list__item-actions',
                  newFormInline.imageList.length > 1 && 'cursor-move!'
                ]"
              >
                <span
                  title="查看"
                  class="hover:text-primary"
                  @click="handlePictureCardPreview(file)"
                >
                  <IconifyIconOffline
                    :icon="Eye"
                    class="hover:scale-125 duration-100"
                  />
                </span>
                <span
                  class="el-upload-list__item-delete"
                  @click="handleRemove(file)"
                >
                  <span title="移除" class="hover:text-(--el-color-danger)">
                    <IconifyIconOffline
                      :icon="Delete"
                      class="hover:scale-125 duration-100"
                    />
                  </span>
                </span>
              </span>
            </div>
          </template>
        </el-upload>
        <el-image-viewer
          v-if="dialogVisible"
          :url-list="previewUrlList"
          :initial-index="curOpenImgIndex"
          @close="dialogVisible = false"
        />
    </el-form-item>

  </el-form>
</template>