import { http } from "@/utils/http";

export type ResolveUploadPathItem = {
  input: string;
  url?: string;
  error?: string;
};

type ResolveUploadPathsResult = {
  code: number;
  message: string;
  data?: {
    results: ResolveUploadPathItem[];
  };
};

export const resolveUploadPaths = (paths: string[]) => {
  return http.request<ResolveUploadPathsResult>("post", "/api/upload/resolve-paths", {
    data: { paths }
  });
};