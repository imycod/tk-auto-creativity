import { http } from "@/utils/http";

type ResultTable = {
  code: number;
  message: string;
  data?: {
    /** 列表数据 */
    list: Array<any>;
    /** 总条目数 */
    total?: number;
    /** 每页显示条目个数 */
    pageSize?: number;
    /** 当前页数 */
    currentPage?: number;
  };
};


/** 获取资产列表 */
export const getAssetsList = (data?: object) => {
  return http.request<ResultTable>("post", "/api/assets/list", { data });
};