import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { FindAllAssetDto } from './dto/find-all-asset.dto';
import { TaskAsset } from '../entities/task-asset.entity';

@Injectable()
export class AssetsService {

  constructor(
    @InjectRepository(TaskAsset)
    private readonly taskAssetsRepository: Repository<TaskAsset>,
  ) { }

  async findAll(dto: FindAllAssetDto): Promise<{ list: TaskAsset[], total: number, currentPage: number, pageSize: number }> {

    const { taskId, assetId, assetType, currentPage = 1, pageSize = 10 } = dto;

    const query = this.taskAssetsRepository.createQueryBuilder('taskAsset');
    if (taskId) {
      query.andWhere('taskAsset.taskId = :taskId', { taskId });
    }
    if (assetId) {
      query.andWhere('taskAsset.assetId = :assetId', { assetId });
    }
    if (assetType) {
      query.andWhere('taskAsset.assetType = :assetType', { assetType });
    }

    // 总数
    const total = await query.getCount();
    // 分页查询
    const list = await query
      .skip((currentPage - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return {
      list,
      total,
      currentPage,
      pageSize,
    };
  }

}
