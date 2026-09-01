import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CreatorsModule } from './creators/creators.module';
import { BrandsModule } from './brands/brands.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ApplicationsModule } from './applications/applications.module';
import { PayoutsModule } from './payouts/payouts.module';
import { SeedModule } from './seed/seed.module';
import { AdminModule } from './admin/admin.module';
import { PaymentModule } from './payments/payment.module';
import { SettingsModule } from './settings/settings.module';
import { MessagesModule } from './messages/messages.module';
import { ContractsModule } from './contracts/contracts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AiModule } from './ai/ai.module';
import { FxModule } from './fx/fx.module';
import { TranslationsModule } from './translations/translations.module';
import { SupportModule } from './support/support.module';
import { UploadsModule } from './uploads/uploads.module';
import { TelegramModule } from './telegram/telegram.module';
import { TrackingModule } from './tracking/tracking.module';
import { RolesModule } from './roles/roles.module';
import { ManagersModule } from './managers/managers.module';
import { InvitationsModule } from './invitations/invitations.module';
import { TasksModule } from './tasks/tasks.module';
import { OffersModule } from './offers/offers.module';
import { PitchModule } from './pitch/pitch.module';
import { EmailModule } from './email/email.module';
import { GeoModule } from './geo/geo.module';
import { MarketsModule } from './markets/markets.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: true, // Auto-create schemas for MVP
    }),
    ServeStaticModule.forRoot({
      rootPath: process.env.UPLOADS_DIR || join(process.cwd(), 'public'),
      serveRoot: '/',
      serveStaticOptions: { index: false },
    }),
    AuthModule,
    UsersModule,
    CreatorsModule,
    BrandsModule,
    CampaignsModule,
    ApplicationsModule,
    PayoutsModule,
    SeedModule,
    AdminModule,
    PaymentModule,
    SettingsModule,
    MessagesModule,
    ContractsModule,
    NotificationsModule,
    AiModule,
    FxModule,
    TranslationsModule,
    SupportModule,
    UploadsModule,
    TelegramModule,
    TrackingModule,
    RolesModule,
    ManagersModule,
    InvitationsModule,
    TasksModule,
    OffersModule,
    PitchModule,
    EmailModule,
    GeoModule,
    MarketsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
