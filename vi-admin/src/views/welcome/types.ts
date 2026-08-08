import type { UploadUserFile } from "element-plus";

interface FormItemProps {
  /** 任务ID */
  taskId?: string;
  /** 状态 */
  status?: string;
  /** 产品ID */
  productId?: string;
  /** 提示词 */
  promptText: string;
  /** 视频时长（秒），4-15 */
  duration: number;
  /** 旧表单字段名，内部已承载图片/视频混合素材 */
  imageList: Array<MediaItem>;
  /** 后端返回的有序素材 */
  assets?: Array<TaskAssetItem>;
}

interface MediaItem extends UploadUserFile {
  response?: any;
  assetType?: "image" | "video";
}

interface TaskAssetItem {
  assetId?: string | number;
  assetType: "image" | "video" | "audio";
  assetPath: string;
  sortOrder?: number;
  meta?: any;
}

interface FormProps {
  formInline: FormItemProps;
  type: "add" | "edit";
}

export type { FormItemProps, FormProps, MediaItem, TaskAssetItem };
