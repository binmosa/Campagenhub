import { Module } from '@nestjs/common';
import { PitchController } from './pitch.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [PitchController],
})
export class PitchModule {}
