import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { Payout } from '../payouts/payout.entity';
import { Application } from '../applications/application.entity';
import { PaymentTransaction } from './payment-transaction.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { TelegramModule } from '../telegram/telegram.module';
import { PayoutAccount } from '../invitations/payout-account.entity';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { Contract } from '../contracts/contract.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payout, Application, PaymentTransaction, PayoutAccount, User, Campaign, Contract]),
    NotificationsModule,
    TelegramModule
  ],
  providers: [PaymentService],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}
