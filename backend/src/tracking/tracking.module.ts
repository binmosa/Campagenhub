import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { ContentSubmission } from './content.entity';
import { Application } from '../applications/application.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContentSubmission, Application])],
  controllers: [TrackingController],
  providers: [TrackingService],
})
export class TrackingModule {}
