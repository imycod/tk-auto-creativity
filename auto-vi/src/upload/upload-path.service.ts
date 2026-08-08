import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  buildUploadPublicUrl,
  collectUploadFilesystemCandidates,
  extractUploadRelativePath,
  inferAssetTypeFromRelativePath,
  inferUploadRoot,
  isAllowedMediaExtension,
  isHttpUrl,
  resolvePublicBaseUrl,
  rewriteUploadMediaUrl,
  type UploadAssetType,
} from './resolve-upload-path.util';

export interface ResolveUploadPathItem {
  input: string;
  url?: string;
  assetType?: UploadAssetType;
  error?: string;
}

@Injectable()
export class UploadPathService {
  constructor(private readonly configService: ConfigService) {}

  private getUploadDir(): string {
    return this.configService.get<string>('UPLOAD_DIR') ?? '/app/uploads/images';
  }

  getUploadRoot(): string {
    return (
      this.configService.get<string>('UPLOAD_ROOT') ??
      inferUploadRoot(this.getUploadDir())
    );
  }

  getMediaDir(assetType: UploadAssetType): string {
    const uploadRoot = this.getUploadRoot();
    if (assetType === 'image') {
      return this.configService.get<string>('UPLOAD_IMAGE_DIR') ?? path.join(uploadRoot, 'images');
    }
    return this.configService.get<string>('UPLOAD_VIDEO_DIR') ?? path.join(uploadRoot, 'videos');
  }

  private getUncPrefix(): string {
    return this.configService.get<string>('UPLOAD_UNC_PREFIX') ?? '';
  }

  getPublicBaseUrl(): string {
    return resolvePublicBaseUrl(
      this.configService.get<string>('PUBLIC_BASE_URL'),
    );
  }

  async resolveOne(
    input: string,
    expectedAssetType?: UploadAssetType,
  ): Promise<ResolveUploadPathItem> {
    const trimmed = input.trim();
    if (!trimmed) {
      return { input, error: '路径为空' };
    }

    if (isHttpUrl(trimmed)) {
      const relative = extractUploadRelativePath(trimmed, this.getUncPrefix());
      const assetType = relative
        ? inferAssetTypeFromRelativePath(relative)
        : expectedAssetType;
      if (expectedAssetType && assetType && assetType !== expectedAssetType) {
        return { input: trimmed, error: '素材类型与路径不匹配' };
      }
      return {
        input: trimmed,
        assetType: assetType ?? expectedAssetType,
        url: rewriteUploadMediaUrl(trimmed, this.getPublicBaseUrl(), expectedAssetType),
      };
    }

    const relative = extractUploadRelativePath(trimmed, this.getUncPrefix());
    if (!relative) {
      return {
        input: trimmed,
        error:
          '无法识别的媒体路径，请使用 UNC、本地绝对路径，或 /api/upload/ 下的图片/视频 URL',
      };
    }

    const assetType = inferAssetTypeFromRelativePath(relative) ?? expectedAssetType;
    if (!assetType) {
      return { input: trimmed, error: '无法识别素材类型，请使用 images/ 或 videos/ 路径' };
    }
    if (expectedAssetType && assetType !== expectedAssetType) {
      return { input: trimmed, error: '素材类型与路径不匹配' };
    }

    const candidates = collectUploadFilesystemCandidates(
      trimmed,
      relative,
      this.getUploadRoot(),
      this.getUncPrefix(),
    );

    if (!candidates.length) {
      return { input: trimmed, assetType, error: '媒体路径无效' };
    }

    let filePath: string | null = null;
    for (const candidate of candidates) {
      const ext = path.extname(candidate);
      if (!isAllowedMediaExtension(assetType, ext)) {
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
        assetType,
        error: `文件不存在或类型不支持（已尝试 ${candidates.join('; ')}）`,
      };
    }

    const filename = path.basename(filePath);
    const url = buildUploadPublicUrl(filename, this.getPublicBaseUrl(), assetType);
    return { input: trimmed, assetType, url };
  }

  async resolveMany(inputs: string[]): Promise<ResolveUploadPathItem[]> {
    return Promise.all(inputs.map((input) => this.resolveOne(input)));
  }

  async resolveImageListForStorage(imageList: string[]): Promise<string[]> {
    const resolved: string[] = [];
    for (const item of imageList) {
      const result = await this.resolveOne(item, 'image');
      if (!result.url) {
        throw new Error(result.error ?? '图片路径无效');
      }
      resolved.push(result.url);
    }
    return resolved;
  }

  async resolveMediaForStorage(
    assetPath: string,
    assetType: UploadAssetType,
  ): Promise<string> {
    const result = await this.resolveOne(assetPath, assetType);
    if (!result.url) {
      throw new Error(result.error ?? '媒体路径无效');
    }
    return result.url;
  }
}
