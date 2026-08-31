import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Start, Update, Command, Ctx, InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { User, UserRole } from '../users/user.entity';

@Update()
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectBot() private bot: Telegraf<Context>
  ) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const payload = (ctx.message as any).text?.split(' ')[1]; // /start <payload>
    const chatId = ctx.chat?.id.toString();
    const username = ctx.from?.username || ctx.from?.first_name || 'User';

    if (payload) {
      if (payload.startsWith('REF_')) {
        // Someone is joining via referral!
        const refCode = payload.split('_')[1];
        const referrer = await this.usersRepository.findOne({ where: { referral_code: refCode } });
        if (referrer) {
          referrer.points += 250;
          await this.usersRepository.save(referrer);
          // We could send a message to referrer, but we need their chat id.
          if (referrer.telegram_chat_id) {
            await this.bot.telegram.sendMessage(referrer.telegram_chat_id, `🎉 Someone joined using your invite link! You earned 250 points!`);
          }
        }
        await ctx.reply(`👋 Welcome to CampaignHub! You were referred by someone awesome. Please log in to the website to connect this Telegram account completely.`);
        return;
      }

      // payload is the connect token
      const user = await this.usersRepository.findOne({ where: { telegram_connect_token: payload } });
      if (user && chatId) {
        user.telegram_chat_id = chatId;
        user.telegram_username = username || '';
        // Optionally clear token so it can't be reused -> user.telegram_connect_token = null;
        user.points += 100; // Award points for connecting!
        await this.usersRepository.save(user);

        await ctx.reply(`✅ Successfully Connected! Welcome to CampaignHub, ${username}.\n🎁 We've also awarded you 100 pts for connecting your account!\n\nUse /commands to see available actions.`);
      } else {
        await ctx.reply(`❌ Invalid or expired connection token. Please generate a new one from your dashboard.`);
      }
    } else {
      await ctx.reply(`👋 Welcome to the CampaignHub Bot! \n\nTo connect your account, please use the "Connect Telegram" button in your Profile Dashboard.`);
    }
  }

  @Command('me')
  async onMe(@Ctx() ctx: Context) {
    const chatId = ctx.chat?.id.toString();
    const user = await this.usersRepository.findOne({ where: { telegram_chat_id: chatId } });
    if (user) {
      await ctx.reply(`👤 You are securely connected as ${user.email} (${user.role}).`);
    } else {
      await ctx.reply(`⚠️ You are not connected to any CampaignHub account.`);
    }
  }

  @Command('help')
  async onHelp(@Ctx() ctx: Context) {
    await ctx.reply(`💡 *CampaignHub Bot Commands:*\n\n/start - Connect your account (requires link from dashboard)\n/me - Check your connection status\n/points - Check your balance\n/challenge - Get today's quest\n/invite - Generate referral link\n/help - Show this message`);
  }

  @Command('points')
  async onPoints(@Ctx() ctx: Context) {
    const chatId = ctx.chat?.id.toString();
    const user = await this.usersRepository.findOne({ where: { telegram_chat_id: chatId } });
    if (user) {
      await ctx.reply(`🏆 *Your Gamification Dashboard*\n\nCurrent Balance: ${user.points} points.\n\nKeep interacting with campaigns and creators to level up your status!`, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(`⚠️ You are not connected. Please connect from your dashboard first.`);
    }
  }

  @Command('challenge')
  async onChallenge(@Ctx() ctx: Context) {
    const chatId = ctx.chat?.id.toString();
    const user = await this.usersRepository.findOne({ where: { telegram_chat_id: chatId } });
    if (!user) {
      return ctx.reply(`⚠️ Connect your account first.`);
    }

    let challenge = '';
    if (user.role === UserRole.CREATOR) {
      challenge = `🎯 *Today's Challenge:* Apply to 1 new campaign and complete an AI tracking verification. Reward: 50 pts.`;
    } else {
      challenge = `🎯 *Today's Challenge:* Review and approve a creator's pending deliverables. Reward: 100 pts.`;
    }

    // Award +5 points just for checking in!
    user.points += 5;
    await this.usersRepository.save(user);

    await ctx.reply(`${challenge}\n\n_You've been awarded 5 pts for checking the daily quest!_`, { parse_mode: 'Markdown' });
  }

  @Command('invite')
  async onInvite(@Ctx() ctx: Context) {
    const chatId = ctx.chat?.id.toString();
    const user = await this.usersRepository.findOne({ where: { telegram_chat_id: chatId } });
    if (!user) {
      return ctx.reply(`⚠️ Connect your account first.`);
    }

    if (!user.referral_code) {
      user.referral_code = `REF-${user.id.substring(0, 8).toUpperCase()}`;
      await this.usersRepository.save(user);
    }

    const inviteLink = `https://t.me/official_CampaignHub_bot?start=REF_${user.referral_code}`;
    await ctx.reply(`🚀 *Refer & Earn*\n\nShare this link to invite users to CampaignHub via Telegram:\n${inviteLink}\n\nEarn 250 points when someone connects their account using your link!`, { parse_mode: 'Markdown' });
  }

  async sendNotification(chatId: string, message: string) {
    try {
      await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      this.logger.log(`Sent Telegram message to ${chatId}`);
    } catch (error) {
      this.logger.error(`Failed to send Telegram message to ${chatId}: ${error.message}`);
    }
  }

  async broadcastToRole(role: string, message: string) {
    const users = await this.usersRepository.find({ where: { role: role as any } });
    for (const user of users) {
      if (user.telegram_chat_id) {
        await this.sendNotification(user.telegram_chat_id, message);
      }
    }
  }

  async disconnectUser(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (user) {
      user.telegram_chat_id = null as any;
      user.telegram_username = null as any;
      user.telegram_connect_token = null as any; // Invalidate current token
      await this.usersRepository.save(user);
    }
  }
}
