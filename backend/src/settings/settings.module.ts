import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSetting } from './setting.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { Application } from '../applications/application.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformSetting, Application, Campaign, User])],
  providers: [SettingsService],
  controllers: [SettingsController],
})
export class SettingsModule {}
