import { Module } from '@nestjs/common';
import { GeoController } from './geo.controller';
import { GeoDetectService } from './geo-detect.service';

@Module({
  controllers: [GeoController],
  providers: [GeoDetectService],
})
export class GeoModule {}
