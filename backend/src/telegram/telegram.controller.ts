import { Controller, Get, Post, UseGuards, Req, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { User, UserRole } from '../users/user.entity';
import { v4 as uuidv4 } from 'uuid';
import { TelegramService } from './telegram.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/telegram')
export class TelegramController {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private telegramService: TelegramService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/stats')
  async getAdminStats() {
    const totalUsers = await this.usersRepository.count({ where: { telegram_chat_id: IsNull() } }); // We use a query builder for NOT NULL, wait
    const total_subscribers = await this.usersRepository.createQueryBuilder('user').where('user.telegram_chat_id IS NOT NULL').andWhere("user.telegram_chat_id != ''").getCount();
    
    return {
      total_subscribers,
      active_today: Math.floor(total_subscribers * 0.4), // mock activity metric
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/broadcast')
  async adminBroadcast(@Body() body: { message: string; target: string }) {
    let qb = this.usersRepository.createQueryBuilder('user').where('user.telegram_chat_id IS NOT NULL').andWhere("user.telegram_chat_id != ''");
    
    if (body.target === 'creators') {
      qb = qb.andWhere('user.role = :role', { role: 'creator' });
    } else if (body.target === 'brands') {
      qb = qb.andWhere('user.role = :role', { role: 'brand' });
    }

    const users = await qb.getMany();
    
    // Broadcast via telegram service
    let sentCount = 0;
    for (const u of users) {
      try {
        await this.telegramService.sendNotification(u.telegram_chat_id, `📢 **GLOBAL BROADCAST**\n\n${body.message}`);
        sentCount++;
      } catch (e) {
        // ignore individual failures
      }
    }
    return { success: true, sentCount };
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus(@Req() req: any) {
    const user = await this.usersRepository.findOne({ where: { id: req.user.userId } });
    if (!user) return { connected: false };
    return {
      connected: !!user.telegram_chat_id,
      username: user.telegram_username,
      chat_id: user.telegram_chat_id,
      points: user.points,
      referral_code: user.referral_code,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('generate-token')
  async generateToken(@Req() req: any) {
    const user = await this.usersRepository.findOne({ where: { id: req.user.userId } });
    if (!user) throw new Error('User not found');
    
    // Generate a fresh connection token
    const token = uuidv4();
    user.telegram_connect_token = token;
    await this.usersRepository.save(user);

    // Provide the bot link (assumes the bot username. I'll pass a placeholder or get it from env)
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || '';
    
    return {
      token,
      botLink: `https://t.me/${botUsername}?start=${token}`,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('disconnect')
  async disconnect(@Req() req: any) {
    const user = await this.usersRepository.findOne({ where: { id: req.user.userId } });
    if (user) {
      user.telegram_chat_id = '';
      user.telegram_username = '';
      user.telegram_connect_token = '';
      await this.usersRepository.save(user);
    }
    return { success: true };
  }
}
