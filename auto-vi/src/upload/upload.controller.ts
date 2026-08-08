import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import * as path from 'path';
import { diskStorage } from 'multer';
import { ApiResponse } from '../common/decorators/api-response.decorator';
import { ResolveUploadPathsDto } from './dto/resolve-upload-paths.dto';
import {
  buildUploadPublicUrl,
  inferUploadRoot,
  resolvePublicBaseUrl,
  type UploadAssetType,
} from './resolve-upload-path.util';
import { UploadPathService } from './upload-path.service';

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const IMAGE_MAX_SIZE = 2 * 1024 * 1024;
const VIDEO_MAX_SIZE = 100 * 1024 * 1024;
const MAX_MEDIA_FILES = 10;

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

const EXTENSIONS_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

export interface UploadedMediaItem {
  url: string;
  assetType: UploadAssetType;
  mimeType: string;
  size: number;
  originalName: string;
}

function getAssetType(mimeType: string): UploadAssetType | null {
  if (IMAGE_MIME_TYPES.has(mimeType)) return 'image';
  if (VIDEO_MIME_TYPES.has(mimeType)) return 'video';
  return null;
}

function getMediaDirFromEnv(assetType: UploadAssetType): string {
  const root = process.env.UPLOAD_ROOT ?? inferUploadRoot(process.env.UPLOAD_DIR ?? '/app/uploads/images');
  return assetType === 'image' ? (process.env.UPLOAD_IMAGE_DIR ?? path.join(root, 'images')) : (process.env.UPLOAD_VIDEO_DIR ?? path.join(root, 'videos'));
}

const mediaStorage = diskStorage({
  destination: async (_req, file, cb) => {
    const assetType = getAssetType(file.mimetype);
    if (!assetType) {
      cb(new BadRequestException('只允许上传 jpg、png、gif、webp、mp4、webm、mov 文件'), '');
      return;
    }
    const uploadDir = getMediaDirFromEnv(assetType);
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
    }
  },
  filename: (_req, file, cb) => {
    const ext = EXTENSIONS_BY_MIME[file.mimetype] ?? path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

@Controller('upload')
export class UploadController {
  constructor(private uploadPathService: UploadPathService) {}

  @Post('resolve-paths')
  @ApiResponse('路径解析成功')
  async resolvePaths(@Body() dto: ResolveUploadPathsDto) {
    const results = await this.uploadPathService.resolveMany(dto.paths);
    return { results };
  }

  @Post('media')
  @UseInterceptors(
    FilesInterceptor('file', MAX_MEDIA_FILES, {
      storage: mediaStorage,
      limits: { fileSize: VIDEO_MAX_SIZE, files: MAX_MEDIA_FILES },
      fileFilter: (_req, file, cb) => {
        if (!getAssetType(file.mimetype)) {
          return cb(
            new BadRequestException('只允许上传 jpg、png、gif、webp、mp4、webm、mov 文件'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadMedia(@UploadedFiles() files: Express.Multer.File[]) {
    return this.buildUploadResponse(files, false);
  }

  @Post('images')
  @UseInterceptors(
    FilesInterceptor('file', MAX_MEDIA_FILES, {
      storage: mediaStorage,
      limits: { fileSize: IMAGE_MAX_SIZE, files: MAX_MEDIA_FILES },
      fileFilter: (_req, file, cb) => {
        if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
          return cb(new BadRequestException('只允许上传图片'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    return this.buildUploadResponse(files, true);
  }

  @Get('media/:assetType/:filename')
  async getMedia(
    @Param('assetType') assetTypeParam: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const assetType = this.normalizeAssetFolder(assetTypeParam);
    return this.sendMedia(assetType, filename, res);
  }

  @Get('images/:filename')
  async getImage(@Param('filename') filename: string, @Res() res: Response) {
    return this.sendMedia('image', filename, res);
  }

  @Get('videos/:filename')
  async getVideo(@Param('filename') filename: string, @Res() res: Response) {
    return this.sendMedia('video', filename, res);
  }

  private async buildUploadResponse(files: Express.Multer.File[], imagesOnly: boolean) {
    if (!files || files.length === 0) {
      throw new BadRequestException('没有上传文件');
    }
    if (files.length > MAX_MEDIA_FILES) {
      await this.removeFiles(files);
      throw new BadRequestException('最多上传10个文件');
    }

    const items: UploadedMediaItem[] = [];
    for (const file of files) {
      const assetType = getAssetType(file.mimetype);
      const maxSize = assetType === 'video' ? VIDEO_MAX_SIZE : IMAGE_MAX_SIZE;
      if (!assetType || (imagesOnly && assetType !== 'image') || file.size > maxSize) {
        await this.removeFiles(files);
        throw new BadRequestException(
          assetType === 'video' ? '单个视频大小不能超过100MB' : '单个图片大小不能超过2MB',
        );
      }

      items.push({
        url: buildUploadPublicUrl(
          path.basename(file.filename),
          resolvePublicBaseUrl(this.uploadPathService.getPublicBaseUrl()),
          assetType,
        ),
        assetType,
        mimeType: file.mimetype,
        size: file.size,
        originalName: file.originalname,
      });
    }

    return {
      urls: items.map((item) => item.url),
      files: items,
    };
  }

  private normalizeAssetFolder(assetTypeParam: string): UploadAssetType {
    const normalized = assetTypeParam.toLowerCase();
    if (normalized === 'images' || normalized === 'image') return 'image';
    if (normalized === 'videos' || normalized === 'video') return 'video';
    throw new NotFoundException('媒体类型不存在');
  }

  private async sendMedia(
    assetType: UploadAssetType,
    filename: string,
    res: Response,
  ) {
    const safeName = path.basename(filename);
    const filePath = path.join(this.uploadPathService.getMediaDir(assetType), safeName);

    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException(assetType === 'image' ? '图片不存在' : '视频不存在');
    }

    const mime = MIME_TYPES[path.extname(safeName).toLowerCase()] ?? 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    createReadStream(filePath).pipe(res);
  }

  private async removeFiles(files: Express.Multer.File[]) {
    await Promise.all(
      files
        .filter((file) => file.path)
        .map((file) => fs.unlink(file.path).catch(() => undefined)),
    );
  }
}
