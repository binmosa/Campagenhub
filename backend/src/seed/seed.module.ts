import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { Campaign } from '../campaigns/campaign.entity';
import { User } from '../users/user.entity';
import { CreatorProfile } from '../creators/creator-profile.entity';
import { BrandProfile } from '../brands/brand-profile.entity';
import { ManagerProfile } from '../managers/manager-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, User, CreatorProfile, BrandProfile, ManagerProfile])],
  providers: [SeedService],
})
export class SeedModule {}
