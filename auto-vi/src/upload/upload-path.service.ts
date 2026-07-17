import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  buildUploadPublicUrl,
  collectUploadFilesystemCandidates,
  extractUploadRelativePath,
  inferUploadRoot,
  isAllowedImageExtension,
  isHttpUrl,
  resolvePublicBaseUrl,
  rewriteUploadImageUrl,
} from './resolve-upload-path.util';

export interface ResolveUploadPathItem {
  input: string;
  url?: string;
  error?: string;
}

@Injectable()
export class UploadPathService {
  constructor(private readonly configService: ConfigService) {}

  private getUploadDir(): string {
    return this.configService.get<string>('UPLOAD_DIR') ?? '/app/uploads/images';
  }

  private getUploadRoot(): string {
    return (
      this.configService.get<string>('UPLOAD_ROOT') ??
      inferUploadRoot(this.getUploadDir())
    );
  }

  private getUncPrefix(): string {
    return this.configService.get<string>('UPLOAD_UNC_PREFIX') ?? '';
  }

  private getPublicBaseUrl(): string {
    return resolvePublicBaseUrl(
      this.configService.get<string>('PUBLIC_BASE_URL'),
    );
  }

  async resolveOne(input: string): Promise<ResolveUploadPathItem> {
    const trimmed = input.trim();
    if (!trimmed) {
      return { input, error: '路径为空' };
    }

    if (isHttpUrl(trimmed)) {
      return {
        input: trimmed,
        url: rewriteUploadImageUrl(trimmed, this.getPublicBaseUrl()),
      };
    }

    const relative = extractUploadRelativePath(trimmed, this.getUncPrefix());
    if (!relative) {
      return {
        input: trimmed,
        error:
          '无法识别的图片路径，请使用 UNC（如 \\TkGravity\\docker\\vi-system\\uploads\\images\\xxx.jpg）、本地绝对路径，或 /api/upload/ 下的 URL',
      };
    }

    const candidates = collectUploadFilesystemCandidates(
      trimmed,
      relative,
      this.getUploadRoot(),
      this.getUncPrefix(),
    );

    if (!candidates.length) {
      return { input: trimmed, error: '图片路径无效' };
    }

    let filePath: string | null = null;
    for (const candidate of candidates) {
      const ext = path.extname(candidate);
      if (!isAllowedImageExtension(ext)) {
        continue;
      }
      try {
        await fs.access(candidate);
        filePath = candidate;
        break;
      } catch {
        // try next candidate
      }
    }

    if (!filePath) {
      return {
        input: trimmed,
        error: `文件不存在（已尝试: ${candidates.join('; ')}）`,
      };
    }

    const filename = path.basename(filePath);
    const url = buildUploadPublicUrl(filename, this.getPublicBaseUrl());
    return { input: trimmed, url };
  }

  async resolveMany(inputs: string[]): Promise<ResolveUploadPathItem[]> {
    return Promise.all(inputs.map((input) => this.resolveOne(input)));
  }

  async resolveImageListForStorage(imageList: string[]): Promise<string[]> {
    const resolved: string[] = [];
    for (const item of imageList) {
      const result = await this.resolveOne(item);
      if (!result.url) {
        throw new Error(result.error ?? '图片路径无效');
      }
      resolved.push(result.url);
    }
    return resolved;
  }
}
