import { BadRequestException, Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { MulterModule } from '@nestjs/platform-express';
import multer from 'multer';

@Module({
  imports: [
    MulterModule.register({
      // storage: multer.diskStorage({ dest: './uploads' }), // 如果要存磁盘就用这个
      storage: multer.memoryStorage(),     // 推荐：存内存后直接写 Samba
      limits: {
        fileSize: 2 * 1024 * 1024,        // 2MB
        files: 10                         // 最多同时上传10个文件
      },
      fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        // 只允许图片
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('只允许上传 jpg、png、gif、webp 格式图片'));
        }
      },
    }),
  ],
  controllers: [UploadController]
})
export class UploadModule {}
