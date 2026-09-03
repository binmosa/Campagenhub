import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreatorsService } from './creators.service';
import { CreatorsController } from './creators.controller';
import { CreatorProfile } from './creator-profile.entity';
import { User } from '../users/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { FollowerVerificationService } from './follower-verification.service';

@Module({
  imports: [TypeOrmModule.forFeature([CreatorProfile, User]), NotificationsModule],
  controllers: [CreatorsController],
  providers: [CreatorsService, FollowerVerificationService],
  exports: [CreatorsService]
})
export class CreatorsModule {}
