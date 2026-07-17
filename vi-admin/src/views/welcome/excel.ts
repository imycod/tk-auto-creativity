import * as XLSX from "xlsx";
import dayjs from "dayjs";

export const DURATION_HEADER = "视频时长";
export const DEFAULT_IMPORT_DURATION = 15;
export const MIN_IMPORT_DURATION = 4;
export const MAX_IMPORT_DURATION = 15;

export const IMAGE_HEADERS = [
  "图片1",
  "图片2",
  "图片3",
  "图片4",
  "图片5",
  "图片6",
  "图片7",
  "图片8"
] as const;

export const TEMPLATE_HEADERS = [
  "提示词",
  DURATION_HEADER,
  ...IMAGE_HEADERS
] as const;

export const EXPORT_HEADERS = [
  "任务ID",
  "产品ID",
  "提示词",
  "图像",
  "视频时长",
  "状态",
  "批次日期",
  "创建时间",
  "更新时间"
] as const;

export interface ImportRow {
  excelRowNumber: number;
  promptText: string;
  duration: number;
  imageList: string[];
}

export interface TaskExportRow {
  taskId?: string;
  productId?: string;
  promptText?: string;
  assets?: Array<{ assetPath?: string; assetId?: string }>;
  duration?: number;
  status?: string;
  batchDate?: string;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
}

function downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, filename);
}

function formatDateTime(value: unknown): string {
  if (!value) return "";
  return dayjs(value as string | number | Date).format("YYYY-MM-DD HH:mm:ss");
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

const IMPORT_IMAGE_PUBLIC_BASE = "http://192.168.50.100:9444/api/upload";
const IMPORT_IMAGE_UNC_PREFIX = "\\TkGravity\\docker\\vi-system\\uploads\\";

export function extractRelativeImagesPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  const apiMarker = "/api/upload/";
  const apiIdx = lower.indexOf(apiMarker);
  if (apiIdx !== -1) {
    return trimmed.slice(apiIdx + apiMarker.length).replace(/^\/+/, "");
  }

  const normalizedUnc = trimmed.replace(/\//g, "\\");
  const uncPrefixLower = IMPORT_IMAGE_UNC_PREFIX.toLowerCase();
  if (normalizedUnc.toLowerCase().startsWith(uncPrefixLower)) {
    return normalizedUnc
      .slice(IMPORT_IMAGE_UNC_PREFIX.length)
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");
  }

  const uploadsMarker = "/uploads/";
  const uploadsIdx = lower.indexOf(uploadsMarker);
  if (uploadsIdx !== -1) {
    const rel = trimmed
      .slice(uploadsIdx + uploadsMarker.length)
      .replace(/^[/\\]+/, "");
    return rel.toLowerCase().startsWith("images/")
      ? rel.replace(/\\/g, "/")
      : `images/${rel.split(/[/\\]/).pop() ?? rel}`;
  }

  if (/^images[/\\]/i.test(trimmed)) {
    return trimmed.replace(/\\/g, "/").replace(/^\/+/, "");
  }

  const baseName = trimmed.split(/[/\\]/).pop() ?? trimmed;
  return `images/${baseName}`;
}

/** Maps UNC / legacy paths to public upload URLs for xlsx import. */
export function toImportImageUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    const rewritten = trimmed
      .replace(/^https?:\/\/localhost:\d+\/api\/upload/i, IMPORT_IMAGE_PUBLIC_BASE)
      .replace(/^https?:\/\/127\.0\.0\.1:\d+\/api\/upload/i, IMPORT_IMAGE_PUBLIC_BASE)
      .replace(/^https?:\/\/\[::1\]:\d+\/api\/upload/i, IMPORT_IMAGE_PUBLIC_BASE);
    if (rewritten !== trimmed) {
      return rewritten;
    }

    const rel = extractRelativeImagesPath(trimmed);
    if (rel) {
      return `${IMPORT_IMAGE_PUBLIC_BASE}/${rel.replace(/^\/+/, "")}`;
    }

    return trimmed;
  }

  const rel = extractRelativeImagesPath(trimmed);
  return `${IMPORT_IMAGE_PUBLIC_BASE}/${rel.replace(/^\/+/, "")}`;
}
const EXPORT_IMAGE_UNC_PREFIX = "\\\\TkGravity\\docker\\vi-system\\uploads\\";

/** Maps API upload URLs to UNC paths for xlsx export only. */
function toExportImagePath(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  const marker = "/api/upload/";
  const idx = trimmed.indexOf(marker);
  if (idx !== -1) {
    return `${EXPORT_IMAGE_UNC_PREFIX}${trimmed.slice(idx + marker.length)}`;
  }

  return trimmed;
}

function isDurationHeader(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return label === DURATION_HEADER || normalized === "duration";
}

function parseDurationCell(
  value: unknown,
  excelRowNumber: number
): { duration?: number; error?: string } {
  const text = cellToString(value);
  if (!text) {
    return { duration: DEFAULT_IMPORT_DURATION };
  }

  const duration = Number(text);
  if (
    !Number.isFinite(duration) ||
    !Number.isInteger(duration) ||
    duration < MIN_IMPORT_DURATION ||
    duration > MAX_IMPORT_DURATION
  ) {
    return {
      error: `第${excelRowNumber}行：视频时长无效，需在4-15秒之间`
    };
  }

  return { duration };
}

export function downloadImportTemplate() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([Array.from(TEMPLATE_HEADERS)]);
  XLSX.utils.book_append_sheet(workbook, sheet, "导入模板");
  downloadWorkbook(workbook, "任务导入模板.xlsx");
}

export function exportTasksToXlsx(
  tasks: TaskExportRow[],
  statusMap: Record<string, string>
) {
  const rows = tasks.map(task => {
    const assetPaths = (task.assets ?? [])
      .map(item => item?.assetPath ?? item?.assetId ?? "")
      .filter(Boolean)
      .map(toExportImagePath)
      .join(",");

    return {
      任务ID: task.taskId ?? "",
      产品ID: task.productId ?? "",
      提示词: task.promptText ?? "",
      图像: assetPaths,
      视频时长: task.duration ?? "",
      状态: statusMap[task.status ?? ""] ?? task.status ?? "",
      批次日期: task.batchDate ?? "",
      创建时间: formatDateTime(task.createdAt),
      更新时间: formatDateTime(task.updatedAt)
    };
  });

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: Array.from(EXPORT_HEADERS)
  });
  XLSX.utils.book_append_sheet(workbook, sheet, "任务列表");
  const filename = `任务列表_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`;
  downloadWorkbook(workbook, filename);
}

export function parseImportWorkbook(
  buffer: ArrayBuffer
): { rows: ImportRow[]; errors: string[] } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: ["Excel 文件为空或格式不正确"] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<(string | number | boolean)[]>(
    sheet,
    { header: 1, defval: "" }
  );

  if (!rawRows.length) {
    return { rows: [], errors: ["Excel 文件为空或格式不正确"] };
  }

  const headerRow = rawRows[0].map(cell => cellToString(cell));
  const promptIndex = headerRow.findIndex(h => h === "提示词");
  const durationIndex = headerRow.findIndex(h => isDurationHeader(h));
  const imageIndices = IMAGE_HEADERS.map(label =>
    headerRow.findIndex(h => h === label)
  );

  if (promptIndex === -1) {
    return { rows: [], errors: ["缺少「提示词」列，请使用标准模板"] };
  }

  const missingImageHeaders = IMAGE_HEADERS.filter(
    (label, idx) => imageIndices[idx] === -1
  ).map(label => `「${label}」`);

  if (missingImageHeaders.length) {
    return {
      rows: [],
      errors: [`缺少图片列：${missingImageHeaders.join("、")}，请下载标准模板`]
    };
  }

  const rows: ImportRow[] = [];
  const errors: string[] = [];
  let hasDataRow = false;

  for (let i = 1; i < rawRows.length; i++) {
    const excelRowNumber = i + 1;
    const row = rawRows[i];
    if (!row || row.every(cell => cellToString(cell) === "")) {
      continue;
    }

    hasDataRow = true;
    const rowErrors: string[] = [];
    const promptText = cellToString(row[promptIndex]);

    if (!promptText) {
      rowErrors.push(`第${excelRowNumber}行：缺少提示词`);
    }

    let duration = DEFAULT_IMPORT_DURATION;
    if (durationIndex !== -1) {
      const parsed = parseDurationCell(row[durationIndex], excelRowNumber);
      if (parsed.error) {
        rowErrors.push(parsed.error);
      } else if (parsed.duration != null) {
        duration = parsed.duration;
      }
    }

    const imageValues = imageIndices.map(idx => cellToString(row[idx]));
    const filledCount = imageValues.filter(Boolean).length;

    if (filledCount === 0) {
      rowErrors.push(`第${excelRowNumber}行：缺少图片`);
    } else {
      let lastFilledIndex = -1;
      for (let j = imageValues.length - 1; j >= 0; j--) {
        if (imageValues[j]) {
          lastFilledIndex = j;
          break;
        }
      }

      for (let j = 0; j <= lastFilledIndex; j++) {
        if (!imageValues[j]) {
          rowErrors.push(`第${excelRowNumber}行：缺少图片${j + 1}`);
        }
      }
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      continue;
    }

    rows.push({
      excelRowNumber,
      promptText,
      duration,
      imageList: imageValues.filter(Boolean)
    });
  }

  if (!hasDataRow) {
    return { rows: [], errors: ["未找到可导入的数据行"] };
  }

  return { rows, errors };
}


function needsPathResolution(imagePath: string): boolean {
  const trimmed = imagePath.trim();
  if (!trimmed) return false;
  return !/^https?:\/\//i.test(trimmed);
}

function isLocalhostUploadUrl(imagePath: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\/api\/upload\//i.test(
    imagePath.trim()
  );
}

export async function resolveImportRowImagePaths(
  rows: ImportRow[],
  resolveFn: (
    paths: string[]
  ) => Promise<
    Array<{ input: string; url?: string; error?: string }>
  >
): Promise<{ rows: ImportRow[]; errors: string[] }> {
  const pathsToResolve = new Set<string>();
  for (const row of rows) {
    for (const imagePath of row.imageList) {
      if (needsPathResolution(imagePath)) {
        pathsToResolve.add(imagePath.trim());
      }
    }
  }

  const resolvedUrlByInput = new Map<string, string>();
  const resolveErrorByInput = new Map<string, string>();
  if (pathsToResolve.size > 0) {
    const results = await resolveFn([...pathsToResolve]);
    for (const item of results) {
      const key = item.input.trim();
      if (item.url) {
        resolvedUrlByInput.set(key, item.url);
      } else if (item.error) {
        resolveErrorByInput.set(key, item.error);
      }
    }
  }

  const errors: string[] = [];
  const resolvedRows: ImportRow[] = [];

  for (const row of rows) {
    const imageList: string[] = [];
    let rowValid = true;

    for (let index = 0; index < row.imageList.length; index++) {
      const original = row.imageList[index].trim();
      if (!needsPathResolution(original) || isLocalhostUploadUrl(original)) {
        imageList.push(toImportImageUrl(original));
        continue;
      }

      const resolvedUrl = resolvedUrlByInput.get(original);
      if (!resolvedUrl) {
        const detail = resolveErrorByInput.get(original) ?? "文件不存在";
        errors.push(
          `第${row.excelRowNumber}行：图片${index + 1} ${detail}`
        );
        rowValid = false;
        break;
      }
      imageList.push(toImportImageUrl(resolvedUrl));
    }

    if (rowValid) {
      resolvedRows.push({ ...row, imageList });
    }
  }

  return { rows: resolvedRows, errors };
}

export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsArrayBuffer(file);
  });
}

