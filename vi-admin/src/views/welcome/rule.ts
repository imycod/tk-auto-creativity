import { reactive } from "vue";
import type { FormRules } from "element-plus";

function getUploadedUrl(item: any): string {
  return item?.response?.data?.files?.[0]?.url ?? item?.response?.data?.urls?.[0] ?? item?.url ?? "";
}

export const formRules = reactive(<FormRules>{
  promptText: [{ required: true, message: "提示词为必填项", trigger: "blur" }],
  duration: [
    { required: true, message: "视频时长为必填项", trigger: "change" },
    {
      type: "number",
      min: 4,
      max: 15,
      message: "视频时长需在4-15秒之间",
      trigger: "change"
    }
  ],
  imageList: [
    {
      required: true,
      validator: (_rule, value, callback) => {
        if (!Array.isArray(value) || value.length === 0) {
          callback(new Error("请至少上传一个素材"));
          return;
        }
        if (value.length > 10) {
          callback(new Error("最多上传10个素材"));
          return;
        }
        const allUploaded = value.every(item => {
          const status = item?.status;
          return Boolean(getUploadedUrl(item)) && !["ready", "uploading", "fail"].includes(status);
        });
        if (!allUploaded) {
          callback(new Error("请等待所有素材上传成功"));
          return;
        }
        callback();
      },
      trigger: "change"
    }
  ]
});
