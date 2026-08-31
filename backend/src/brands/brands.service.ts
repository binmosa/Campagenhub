import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrandProfile } from './brand-profile.entity';
import { User, UserRole } from '../users/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(BrandProfile)
    private profileRepository: Repository<BrandProfile>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async getProfile(userId: string): Promise<BrandProfile | null> {
    return this.profileRepository.findOne({ 
      where: { user: { id: userId } },
      relations: ['manager', 'manager.managerProfile']
    });
  }

  async updateProfile(userId: string, data: Partial<BrandProfile>): Promise<BrandProfile> {
    let profile = await this.getProfile(userId);
    
    if (!profile) {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) throw new Error("User not found");
      profile = this.profileRepository.create({ ...data, user });
    } else {
      this.profileRepository.merge(profile, data);
    }
    
    return this.profileRepository.save(profile);
  }

  // ===== Team Management =====

  async getTeamMembers(brandId: string): Promise<any[]> {
    const members = await this.usersRepository.find({
      where: { parent_brand_id: brandId },
      order: { created_at: 'DESC' },
    });
    return members.map(m => ({
      id: m.id,
      email: m.email,
      role: m.role,
      permissions: m.permissions,
      is_banned: m.is_banned,
      created_at: m.created_at,
    }));
  }

  async createTeamMember(brandId: string, email: string, password: string, permissions: Record<string, boolean>): Promise<any> {
    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already exists');

    const password_hash = await bcrypt.hash(password, 10);
    const member = this.usersRepository.create({
      email,
      password_hash,
      role: UserRole.BRAND,
      parent_brand_id: brandId,
      permissions,
    });
    const saved = await this.usersRepository.save(member);
    return { id: saved.id, email: saved.email, permissions: saved.permissions, created_at: saved.created_at };
  }

  async updateTeamMember(brandId: string, memberId: string, permissions: Record<string, boolean>): Promise<any> {
    const member = await this.usersRepository.findOne({ where: { id: memberId, parent_brand_id: brandId } });
    if (!member) throw new NotFoundException('Team member not found');
    member.permissions = permissions;
    await this.usersRepository.save(member);
    return { id: member.id, permissions: member.permissions };
  }

  async removeTeamMember(brandId: string, memberId: string): Promise<any> {
    const member = await this.usersRepository.findOne({ where: { id: memberId, parent_brand_id: brandId } });
    if (!member) throw new NotFoundException('Team member not found');
    await this.usersRepository.remove(member);
    return { success: true };
  }
}
