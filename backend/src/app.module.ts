import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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


/**
 * Throttle ceilings. The defaults are the production numbers; an automated
 * test run signs in dozens of times a minute and raises them through the
 * environment. Deliberately a number to raise, not a switch to turn off —
 * there is no value here that disables throttling entirely.
 */
const throttleLimit = (key: string, fallback: number): number => {
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
};

@Module({
  imports: [
    /*
     * Request throttling, applied to every route.
     *
     * Nothing limited how fast anyone could call the API: login is an
     * unauthenticated bcrypt endpoint, so password guessing was purely a
     * question of patience. Three windows run together — a burst allowance
     * for ordinary browsing, and tighter medium/long windows that catch a
     * script hammering a single endpoint. Auth routes narrow this further
     * with their own @Throttle.
     */
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: throttleLimit('THROTTLE_SHORT', 20) },
      { name: 'medium', ttl: 60_000, limit: throttleLimit('THROTTLE_MEDIUM', 300) },
      { name: 'long', ttl: 15 * 60_000, limit: throttleLimit('THROTTLE_LONG', 2_000) },
    ]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      /*
       * Schema auto-sync is how this app has always created its tables, but
       * letting TypeORM ALTER a live database on every deploy is how columns
       * (and the payments in them) get dropped. It is on by default outside
       * production; a fresh production database needs one boot with
       * DB_SYNCHRONIZE=true to create the schema, then turn it back off.
       */
      synchronize:
        process.env.DB_SYNCHRONIZE === 'true' ||
        (process.env.DB_SYNCHRONIZE !== 'false' && process.env.NODE_ENV !== 'production'),
    }),
    ServeStaticModule.forRoot({
      rootPath: process.env.UPLOADS_DIR || join(process.cwd(), 'public'),
      serveRoot: '/',
      serveStaticOptions: {
        index: false,
        // Uploads are user-supplied bytes served from the API origin: never
        // let a browser sniff one into something executable.
        setHeaders: (res: any) => {
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'");
        },
      },
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
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
