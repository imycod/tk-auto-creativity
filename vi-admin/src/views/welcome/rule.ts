import { reactive } from "vue";
import type { FormRules } from "element-plus";

/** 自定义表单规则校验 */
export const formRules = reactive(<FormRules>{
  promptText: [{ required: true, message: "提示词为必填项", trigger: "blur" }],
  duration: [
    { required: true, message: "视频时长为必填项", trigger: "change" },
    {
      type: "number",
      min: 4,
      max: 15,
      message: "视频时长需在 4-15 秒之间",
      trigger: "change"
    }
  ],
  imageList: [
    {
      required: true,
      validator: (_rule, value, callback) => {
        if (!Array.isArray(value) || value.length === 0) {
          callback(new Error("请至少上传一张图片"));
          return;
        }
        const uploaded = value.some(
          item =>
            item?.status === "success" ||
            item?.url ||
            item?.response?.data?.urls?.length
        );
        if (!uploaded) {
          callback(new Error("请至少上传一张图片"));
          return;
        }
        callback();
      },
      trigger: "change"
    }
  ]
});