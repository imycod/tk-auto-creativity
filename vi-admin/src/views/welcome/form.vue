<script setup lang="ts">
import { ref, computed } from "vue";
import { formRules } from "./rule";
import { FormProps } from "./types";
import { message } from "@/utils/message";
import { UploadFile } from "element-plus";

const VITE_UPLOAD_MEDIA_URL =
  (import.meta.env.VITE_UPLOAD_MEDIA_URL as unknown as string) ||
  (import.meta.env.VITE_UPLOAD_IMAGE_URL as unknown as string);

import EpPlus from "~icons/ep/plus?width=30&height=30";
import Eye from "~icons/ri/eye-line";
import Delete from "~icons/ri/delete-bin-7-line";

const MAX_MEDIA_COUNT = 10;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const ACCEPT_MEDIA = [...IMAGE_TYPES, ...VIDEO_TYPES].join(",");

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

const previewUrlList = computed(() =>
  newFormInline.value.imageList
    .filter(item => getUploadAssetType(item) === "image")
    .map(img => getUploadUrl(img))
    .filter(Boolean)
);

function getRef() {
  return ruleFormRef.value;
}

const onExceed = () => {
  message(`最多上传${MAX_MEDIA_COUNT}个素材，请先删除后再上传`);
};

const handleRemove = (file: UploadFile) => {
  const index = newFormInline.value.imageList.findIndex(
    item => item.uid === file.uid || item.url === file.url
  );
  if (index !== -1) {
    newFormInline.value.imageList.splice(index, 1);
  }
  ruleFormRef.value?.validateField("imageList").catch(() => undefined);
};

const MIN_IMAGE_PX = 300;
const MAX_IMAGE_PX = 6000;

function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取图片尺寸"));
    };
    img.src = url;
  });
}

const onBefore = async (file: File) => {
  const isImage = IMAGE_TYPES.includes(file.type);
  const isVideo = VIDEO_TYPES.includes(file.type);
  if (!isImage && !isVideo) {
    message("只能上传图片或视频");
    return false;
  }

  if (isVideo) {
    if (file.size / 1024 / 1024 > 100) {
      message("视频太大，单个视频不能超过100MB", { type: "warning" });
      return false;
    }
    return true;
  }

  if (file.size / 1024 / 1024 > 2) {
    message("单个图片大小不能超过2MB");
    return false;
  }

  try {
    const { width, height } = await readImageSize(file);
    if (
      width < MIN_IMAGE_PX ||
      height < MIN_IMAGE_PX ||
      width > MAX_IMAGE_PX ||
      height > MAX_IMAGE_PX
    ) {
      message(
        `图片尺寸需在${MIN_IMAGE_PX}px-${MAX_IMAGE_PX}px之间（当前${width}×${height}）`,
        { type: "warning" }
      );
      return false;
    }
  } catch {
    message("无法读取图片尺寸，请换一张图重试", { type: "error" });
    return false;
  }

  return true;
};

const handlePictureCardPreview = (file: UploadFile) => {
  if (getUploadAssetType(file) !== "image") return;
  const fileUrl = getUploadUrl(file);
  const index = previewUrlList.value.findIndex(url => url === fileUrl);
  curOpenImgIndex.value = index === -1 ? 0 : index;
  dialogVisible.value = true;
};

const handleUploadSuccess = (response: any, file: UploadFile) => {
  const uploaded = response?.data?.files?.[0];
  const legacyUrl = response?.data?.urls?.[0];
  if (response?.code !== 200 || (!uploaded?.url && !legacyUrl)) {
    message("上传响应异常", { type: "error" });
    return;
  }
  file.url = uploaded?.url ?? legacyUrl;
  (file as any).assetType = uploaded?.assetType ?? inferAssetType(file.url || file.name);
  ruleFormRef.value?.validateField("imageList").catch(() => undefined);
};

function getUploadUrl(file: any): string {
  return file?.response?.data?.files?.[0]?.url ?? file?.response?.data?.urls?.[0] ?? file?.url ?? "";
}

function inferAssetType(input = ""): "image" | "video" {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(input) || /\/videos\//i.test(input)
    ? "video"
    : "image";
}

function getUploadAssetType(file: any): "image" | "video" {
  return file?.assetType ?? file?.response?.data?.files?.[0]?.assetType ?? inferAssetType(getUploadUrl(file) || file?.name);
}

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
    <el-form-item label="素材" prop="imageList">
      <el-upload
        v-model:file-list="newFormInline.imageList"
        drag
        multiple
        class="pure-upload"
        list-type="picture-card"
        :accept="ACCEPT_MEDIA"
        :action="VITE_UPLOAD_MEDIA_URL"
        :limit="MAX_MEDIA_COUNT"
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
              v-if="getUploadAssetType(file) === 'image'"
              class="el-upload-list__item-thumbnail select-none"
              :src="getUploadUrl(file)"
            />
            <video
              v-else
              class="el-upload-list__item-thumbnail select-none"
              :src="getUploadUrl(file)"
              controls
              muted
            />
            <span
              id="pure-upload-item"
              :class="[
                'el-upload-list__item-actions',
                newFormInline.imageList.length > 1 && 'cursor-move!'
              ]"
            >
              <span
                v-if="getUploadAssetType(file) === 'image'"
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
