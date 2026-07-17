import { Controller, Post, Get, Param, Res, UseInterceptors, UploadedFiles, BadRequestException, NotFoundException, Body } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ApiResponse } from '../common/decorators/api-response.decorator';
import { ResolveUploadPathsDto } from './dto/resolve-upload-paths.dto';
import {
  buildUploadPublicUrl,
  resolvePublicBaseUrl,
} from './resolve-upload-path.util';
import { UploadPathService } from './upload-path.service';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

@Controller('upload')
export class UploadController {
  constructor(
    private configService: ConfigService,
    private uploadPathService: UploadPathService,
  ) {}

  @Post('resolve-paths')
  @ApiResponse('路径解析成功')
  async resolvePaths(@Body() dto: ResolveUploadPathsDto) {
    const results = await this.uploadPathService.resolveMany(dto.paths);
    return { results };
  }

  @Post('images')
  @UseInterceptors(
    FilesInterceptor('file', 10, {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new BadRequestException('只允许上传图片'), false);
        }
        cb(null, true);
      },
    })
  )
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('没有上传文件');
    }

    const uploadDir = this.configService.get('UPLOAD_DIR') ?? '/app/uploads/images';
    await fs.mkdir(uploadDir, { recursive: true });

    const publicUrls: string[] = [];

    for (const file of files) {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      const destPath = path.join(uploadDir, uniqueName);

      try {
        await fs.writeFile(destPath, file.buffer);

        const publicUrl = buildUploadPublicUrl(
          uniqueName,
          resolvePublicBaseUrl(
            this.configService.get<string>('PUBLIC_BASE_URL'),
          ),
        );
        publicUrls.push(publicUrl);
      } catch (err) {
        console.error('文件写入失败:', destPath, err);
        throw new BadRequestException('文件保存失败');
      }
    }

    return {
      code: 200,
      message: '上传成功',
      urls: publicUrls,
    };
  }

  @Get('images/:filename')
  async getImage(@Param('filename') filename: string, @Res() res: Response) {
    const uploadDir = this.configService.get('UPLOAD_DIR') ?? '/app/uploads/images';
    const safeName = path.basename(filename);
    const filePath = path.join(uploadDir, safeName);

    let data: Buffer;
    try {
      data = await fs.readFile(filePath);
    } catch {
      throw new NotFoundException('图片不存在');
    }

    const mime = MIME_TYPES[path.extname(safeName).toLowerCase()] ?? 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(data);
  }
}
