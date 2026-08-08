import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadPathService } from './upload-path.service';

@Module({
  controllers: [UploadController],
  providers: [UploadPathService],
  exports: [UploadPathService],
})
export class UploadModule {}
