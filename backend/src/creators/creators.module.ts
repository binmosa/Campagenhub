import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreatorsService } from './creators.service';
import { CreatorsController } from './creators.controller';
import { CreatorProfile } from './creator-profile.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CreatorProfile, User])],
  controllers: [CreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService]
})
export class CreatorsModule {}
