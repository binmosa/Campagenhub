import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { SupportTicket } from './support-ticket.entity';
import { Review } from './review.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SupportTicket, Review])],
  providers: [SupportService],
  controllers: [SupportController],
  exports: [SupportService],
})
export class SupportModule {}
