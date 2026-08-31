import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegrafModule } from 'nestjs-telegraf';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    TelegrafModule.forRoot({
      token: process.env.TELEGRAM_BOT_TOKEN || '',
      // Prevent local/dev crashes when another bot instance is already polling.
      // Notifications can still be sent via bot.telegram without long polling.
      launchOptions: process.env.ENABLE_TELEGRAM_POLLING === 'true'
        ? { dropPendingUpdates: true }
        : false,
    }),
  ],
  providers: [TelegramService],
  controllers: [TelegramController],
  exports: [TelegramService],
})
export class TelegramModule {}
