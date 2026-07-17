import { BadRequestException, Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadPathService } from './upload-path.service';
import { MulterModule } from '@nestjs/platform-express';
import multer from 'multer';

@Module({
  imports: [
    MulterModule.register({
      // storage: multer.diskStorage({ dest: './uploads' }), // 濡傛灉瑕佸瓨纾佺洏灏辩敤杩欎釜
      storage: multer.memoryStorage(),     // 鎺ㄨ崘锛氬瓨鍐呭瓨鍚庣洿鎺ュ啓 Samba
      limits: {
        fileSize: 2 * 1024 * 1024,        // 2MB
        files: 10                         // 鏈€澶氬悓鏃朵笂浼?0涓枃浠?
      },
      fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        // 鍙厑璁稿浘鐗?
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('鍙厑璁镐笂浼?jpg銆乸ng銆乬if銆亀ebp 鏍煎紡鍥剧墖'));
        }
      },
    }),
  ],
  controllers: [UploadController],
  providers: [UploadPathService],
  exports: [UploadPathService]
})
export class UploadModule {}

