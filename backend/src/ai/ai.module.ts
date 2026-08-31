import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { LlmService } from './llm.service';
import { AiController } from './ai.controller';
import { Campaign } from '../campaigns/campaign.entity';
import { CreatorProfile } from '../creators/creator-profile.entity';
import { User } from '../users/user.entity';
import { Application } from '../applications/application.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, CreatorProfile, User, Application]),
  ],
  controllers: [AiController],
  providers: [AiService, LlmService],
  exports: [AiService, LlmService],
})
export class AiModule {}
