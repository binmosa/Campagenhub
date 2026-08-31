import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagerProfile } from './manager-profile.entity';
import { ManagerFeedback } from './manager-feedback.entity';
import { ManagersService } from './managers.service';
import { ManagersController } from './managers.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ManagerProfile, ManagerFeedback]),
    UsersModule,
  ],
  providers: [ManagersService],
  controllers: [ManagersController],
  exports: [ManagersService],
})
export class ManagersModule {}
