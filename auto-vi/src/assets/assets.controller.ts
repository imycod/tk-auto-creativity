import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { FindAllAssetDto } from './dto/find-all-asset.dto';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}


  @Post('list')
  findAll(@Body() dto: FindAllAssetDto) {
    return this.assetsService.findAll(dto);
  }

}
