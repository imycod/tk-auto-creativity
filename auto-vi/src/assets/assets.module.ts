import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskAsset } from '../entities/task-asset.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskAsset]),
  ],
  controllers: [AssetsController],
  providers: [AssetsService],
})
export class AssetsModule {}
