import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSetting } from './setting.entity';
import { Application } from '../applications/application.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { User, UserRole } from '../users/user.entity';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(PlatformSetting)
    private settingsRepository: Repository<PlatformSetting>,
    @InjectRepository(Application)
    private applicationsRepository: Repository<Application>,
    @InjectRepository(Campaign)
    private campaignsRepository: Repository<Campaign>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    // Seed default settings
    const defaults = [
      { key: 'ticker_enabled', value: 'true' },
      { key: 'ticker_text', value: '⚡ Adidas, ⚡ Nike, ⚡ Apple, ⚡ Google, ⚡ Microsoft' },
      { key: 'notifications_enabled', value: 'true' },
      { key: 'notifications_mock_enabled', value: 'true' },
      { key: 'stats_use_real_data', value: 'false' },
      { key: 'for_brands_enabled', value: 'true' },
      { key: 'for_creators_enabled', value: 'true' },
      { key: 'testimonials_enabled', value: 'true' },
      { key: 'testimonials_mock_enabled', value: 'true' },
      { key: 'faq_enabled', value: 'true' },
      { key: 'contact_enabled', value: 'true' },
      { key: 'hero_title', value: '' },
      { key: 'hero_subtitle', value: '' },
      { key: 'about_text', value: '' },
    ];

    for (const setting of defaults) {
      const exists = await this.settingsRepository.findOne({ where: { key: setting.key } });
      if (!exists) {
        const newSetting = this.settingsRepository.create(setting);
        await this.settingsRepository.save(newSetting);
      }
    }
  }

  async getAllSettings() {
    const settings = await this.settingsRepository.find();
    return settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);
  }

  async updateSetting(key: string, value: string) {
    let setting = await this.settingsRepository.findOne({ where: { key } });
    if (!setting) {
      setting = this.settingsRepository.create({ key, value });
    } else {
      setting.value = value;
    }
    await this.settingsRepository.save(setting);
    return setting;
  }

  async getRecentActivity() {
    // Fetch last 5 applications
    const apps = await this.applicationsRepository.find({
      relations: ['creator', 'creator.creatorProfile', 'campaign', 'campaign.brand'],
      order: { created_at: 'DESC' },
      take: 5
    });

    const activity = apps.map(app => {
      // Use profile name, fallback to email prefix
      let nameStr = app.creator?.creatorProfile?.full_name;
      if (!nameStr && app.creator?.email) {
         nameStr = app.creator.email.split('@')[0];
      }
      return {
        user: nameStr || 'A Creator',
        action: 'just applied to a campaign by',
        target: app.campaign?.brand?.brandProfile?.company_name || 'a brand'
      };
    });

    return activity;
  }

  async getPlatformStats() {
    const creatorCount = await this.usersRepository.count({ where: { role: UserRole.CREATOR } });
    const brandCount = await this.usersRepository.count({ where: { role: UserRole.BRAND } });
    const activeCampaigns = await this.campaignsRepository.count({ where: { status: 'active' } });
    const totalApplications = await this.applicationsRepository.count();
    return { creatorCount, brandCount, activeCampaigns, totalApplications };
  }
}
