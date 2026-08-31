import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invitation } from './invitation.entity';
import { BrandTeam } from './brand-team.entity';
import { PayoutAccount } from './payout-account.entity';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { PayoutAccountsService } from './payout-accounts.service';
import { PayoutAccountsController } from './payout-accounts.controller';
import { User } from '../users/user.entity';
import { ManagerProfile } from '../managers/manager-profile.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invitation, BrandTeam, PayoutAccount, User, ManagerProfile]),
    NotificationsModule,
  ],
  providers: [InvitationsService, PayoutAccountsService],
  controllers: [InvitationsController, PayoutAccountsController],
  exports: [InvitationsService, PayoutAccountsService],
})
export class InvitationsModule {}
