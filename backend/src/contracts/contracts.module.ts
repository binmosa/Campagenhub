import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invitation } from '../invitations/invitation.entity';
import { BrandTeam } from '../invitations/brand-team.entity';
import { Contract } from './contract.entity';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { Application } from '../applications/application.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, Application, Invitation, BrandTeam]),
    NotificationsModule
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
