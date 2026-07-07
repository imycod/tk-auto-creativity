interface FormItemProps {
  /** 任务ID */
  taskId?: string;
  /** 状态 */
  status?: string;
  /** 产品ID */
  productId?: string;
  /** 提示词 */
  promptText: string;
  /** 图像列表 */
  imageList: Array<ImageItem>;
}
interface ImageItem {
  name: string;
  url: string;
}
interface FormProps {
  formInline: FormItemProps;
  type: "add" | "edit";
}

export type { FormItemProps, FormProps };