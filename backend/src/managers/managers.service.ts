import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ManagerProfile } from './manager-profile.entity';
import { ManagerFeedback } from './manager-feedback.entity';
import { UsersService } from '../users/users.service';
import { withDerivedFullName } from '../core/name.util';

@Injectable()
export class ManagersService {
  constructor(
    @InjectRepository(ManagerProfile)
    private managersRepo: Repository<ManagerProfile>,
    @InjectRepository(ManagerFeedback)
    private feedbackRepo: Repository<ManagerFeedback>,
    private usersService: UsersService,
  ) {}

  private fallbackNameFromEmail(email: string) {
    const local = (email || '').split('@')[0] || 'Manager';
    return local.charAt(0).toUpperCase() + local.slice(1);
  }

  async getMyProfile(userId: string) {
    let profile = await this.managersRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });

    if (profile) return profile;

    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    profile = this.managersRepo.create({
      user,
      full_name: this.fallbackNameFromEmail(user.email),
      bio: 'Verified Professional Social Media Manager ready to scale your enterprise brand with elite ROI strategies.',
      rating: 5.0,
      blacklisted_brand_ids: [],
    } as any) as unknown as ManagerProfile;

    return this.managersRepo.save(profile);
  }

  async createProfile(userId: string, data: any) {
    data = withDerivedFullName(data);
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');
    let profile = await this.managersRepo.findOne({ where: { user: { id: userId } } });
    if (!profile) {
      profile = this.managersRepo.create({ user, ...data, blacklisted_brand_ids: [] } as any) as unknown as ManagerProfile;
    } else {
      Object.assign(profile, data);
    }
    return this.managersRepo.save(profile!);
  }

  async getAllPublicManagers(filters?: {
    search?: string;
    sort?: string;
    minRating?: string;
    limit?: string;
    offset?: string;
  }) {
    // Auto-sync missing profiles for any managers previously approved
    const activeManagers = await this.managersRepo.manager.query(`
       SELECT id, email FROM users
       WHERE role = 'manager' AND account_status = 'active'
       AND id NOT IN (SELECT user_id FROM manager_profiles)
    `);

    for (const u of activeManagers) {
       const fallbackName = this.fallbackNameFromEmail(u.email);
       const newProfile = this.managersRepo.create({
         user: { id: u.id },
         full_name: fallbackName,
         bio: 'Verified Professional Social Media Manager ready to scale your enterprise brand with elite ROI strategies.',
         rating: 5.0,
         blacklisted_brand_ids: []
       } as any) as unknown as ManagerProfile;
       await this.managersRepo.save(newProfile);
    }

    let results = await this.managersRepo.find({
      where: { user: { account_status: 'active' } },
      relations: ['user'],
      select: {
         id: true,
         first_name: true,
         last_name: true,
         full_name: true,
         bio: true,
         rating: true,
         avatar_url: true,
         location: true,
         specialty: true,
         experience_years: true,
         user: { id: true }
      }
    });

    if (filters?.search) {
      const s = filters.search.toLowerCase();
      results = results.filter(m =>
        m.full_name?.toLowerCase().includes(s) ||
        m.bio?.toLowerCase().includes(s)
      );
    }
    if (filters?.minRating) {
      const min = parseFloat(filters.minRating);
      results = results.filter(m => Number(m.rating) >= min);
    }
    if (filters?.sort === 'rating_desc') {
      results.sort((a, b) => Number(b.rating) - Number(a.rating));
    } else if (filters?.sort === 'name') {
      results.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    }

    // Paginated envelope, matching /creators/public-list. Manager counts are
    // small so in-memory filter+slice is fine here for now.
    const limit = Math.min(Math.max(parseInt(filters?.limit || '24') || 24, 1), 100);
    const offset = Math.max(parseInt(filters?.offset || '0') || 0, 0);
    const total = results.length;
    const items = results.slice(offset, offset + limit);

    return { items, total, limit, offset, hasMore: offset + items.length < total };
  }


  async submitFeedback(brandId: string, managerId: string, rating: number, feedback_text: string) {
    const feedback = this.feedbackRepo.create({
       brand: { id: brandId },
       manager: { id: managerId },
       rating,
       feedback_text
    });
    return this.feedbackRepo.save(feedback);
  }

  async getAllFeedback() {
    return this.feedbackRepo.find({
      relations: ['brand', 'brand.brandProfile', 'manager', 'manager.managerProfile'],
      order: { created_at: 'DESC' }
    });
  }

  async resolveFeedback(id: string, status: string) {
    const feedback = await this.feedbackRepo.findOne({ 
      where: { id },
      relations: ['brand', 'manager', 'manager.managerProfile']
    });
    
    if (!feedback) throw new BadRequestException('Feedback not found');
    feedback.status = status;
    await this.feedbackRepo.save(feedback);

    if (status === 'approved') {
       // Update manager rating and blacklist handling
       const managerProfile = feedback.manager.managerProfile;
       if (managerProfile) {
          managerProfile.rating = (Number(managerProfile.rating) * 0.8) + (feedback.rating * 0.2); // Exponential moving average
          let blacklist = managerProfile.blacklisted_brand_ids || [];
          if (!blacklist.includes(feedback.brand.id)) blacklist.push(feedback.brand.id);
          managerProfile.blacklisted_brand_ids = blacklist;
          await this.managersRepo.save(managerProfile);
       }

       // Auto assign a new random manager
       const result = await this.feedbackRepo.query(`
          SELECT id FROM manager_profiles 
          ORDER BY RANDOM() LIMIT 1
       `);
       if (result && result.length > 0) {
          await this.feedbackRepo.query(`
            UPDATE brand_profiles SET assigned_manager_id = $1 WHERE user_id = $2
          `, [result[0].user_id || result[0].id, feedback.brand.id]);
       }
    }
    return { success: true };
  }
}
