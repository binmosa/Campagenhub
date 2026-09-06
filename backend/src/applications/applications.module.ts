import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { Application } from './application.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { Contract } from '../contracts/contract.entity';
import { BrandTeam } from '../invitations/brand-team.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContractsModule } from '../contracts/contracts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, Campaign, Contract, BrandTeam]),
    NotificationsModule,
    ContractsModule,
  ],
  providers: [ApplicationsService],
  controllers: [ApplicationsController],
})
export class ApplicationsModule {}
