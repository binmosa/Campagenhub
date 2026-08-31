import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { Application } from '../applications/application.entity';
import { Payout } from '../payouts/payout.entity';
import { PayoutAccount } from '../invitations/payout-account.entity';
import { InvitationsModule } from '../invitations/invitations.module';
import { TelegramModule } from '../telegram/telegram.module';
import { PaymentTransaction } from '../payments/payment-transaction.entity';
import { PaymentModule } from '../payments/payment.module';
import { AuditLog } from './audit-log.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Campaign, Application, Payout, PayoutAccount, PaymentTransaction, AuditLog]),
    InvitationsModule,
    TelegramModule,
    PaymentModule,
    NotificationsModule,
  ],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
