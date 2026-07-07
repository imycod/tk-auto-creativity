import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConsumerService } from './consumer.service';
import { CoreModule } from '../core/core.module';

@Module({
  imports: [HttpModule, CoreModule],
  controllers: [],
  providers: [ConsumerService],
})
export class ConsumerModule {}
