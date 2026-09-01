import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Translation } from './translation.entity';
import { TranslationsService } from './translations.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([Translation]), AiModule],
  providers: [TranslationsService],
  exports: [TranslationsService],
})
export class TranslationsModule {}
