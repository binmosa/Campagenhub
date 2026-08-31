import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../users/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatorProfile } from '../creators/creator-profile.entity';
import { BrandProfile } from '../brands/brand-profile.entity';
import { ManagerProfile } from '../managers/manager-profile.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(CreatorProfile) private readonly creatorProfiles: Repository<CreatorProfile>,
    @InjectRepository(BrandProfile) private readonly brandProfiles: Repository<BrandProfile>,
    @InjectRepository(ManagerProfile) private readonly managerProfiles: Repository<ManagerProfile>,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password_hash))) {
      if (user.is_banned) return null; // Banned users cannot login

      const role = (user.role || '').toLowerCase().trim();
      const status = (user.account_status || '').toLowerCase().trim();
      // Only block at login if account is rejected. Pending verification users
      // can still log in — they'll see a non-blocking KYC banner in-app once
      // the admin flips `kyc_required` to true.
      if (['creator', 'brand', 'manager'].includes(role)) {
        if (status === 'rejected') {
          return { blocked_reason: 'REJECTED' };
        }
      }

      const { password_hash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    let finalPermissions = user.permissions || {};
    let customRoleName = null;
    
    // If the user has a custom role assigned, override tracking with its JSON permissions
    if (user.custom_role_id) {
       try {
         // Direct DB query via users service or we can rely on eager loading if we configure it,
         // but for speed we'll do a quick lookup via injected RolesService or just assume the frontend will fetch it.
         // To avoid circular dependency immediately, we just pass custom_role_id and let frontend fetch permissions.
       } catch (e) {}
    }

    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        account_status: user.account_status,
        permissions: finalPermissions,
        custom_role_id: user.custom_role_id,
        is_banned: user.is_banned,
        telegram_connect_token: user.telegram_connect_token
      }
    };
  }

  async register(
    email: string,
    pass: string,
    role: string,
    profile?: any,
  ) {
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // Defaulting to 10 rounds for speed in MVP
    const password_hash = await bcrypt.hash(pass, 10);
    const telegram_connect_token = require('crypto').randomBytes(8).toString('hex');

    const normalizedRole = (role || '').toLowerCase().trim();

    // Simple-signup flow: every new account starts as `active`. KYC is
    // optional and only triggered when an admin flips `kyc_required=true`
    // via PATCH /admin/users/:id/require-kyc.
    const user = await this.usersService.create({
      email,
      password_hash,
      role: normalizedRole,
      telegram_connect_token,
      account_status: 'active',
      kyc_required: false,
    });

    try {
      // Create role profile immediately (so UI has something to load once approved)
      if (normalizedRole === 'creator') {
        const rawUsername = typeof profile?.username === 'string' ? profile.username.trim() : '';
        const creatorPayload = {
          ...(profile || {}),
          username: rawUsername || null,
        };
        await this.creatorProfiles.save(this.creatorProfiles.create({ user: { id: user.id } as any, ...creatorPayload }));
      }
      if (normalizedRole === 'brand') {
        await this.brandProfiles.save(this.brandProfiles.create({ user: { id: user.id } as any, ...(profile || {}) }));
      }
      if (normalizedRole === 'manager') {
        await this.managerProfiles.save(this.managerProfiles.create({ user: { id: user.id } as any, ...(profile || {}) }));
      }
    } catch (error: any) {
      // Avoid half-created users when profile insert fails (e.g., unique constraints)
      try {
        await this.usersService.remove(user.id);
      } catch (_) {}
      if (error?.code === '23505') {
        throw new ConflictException('Profile details already exist. Please use a different username/email.');
      }
      throw new BadRequestException('Failed to create profile. Please review your registration details.');
    }

    // Active straight away — log them in with a token.
    return this.login(user);
  }

  async submitKyc(
    userId: string,
    kyc_id_front: string,
    kyc_id_back: string,
    kyc_video_url: string,
  ) {
    if (!kyc_id_front || !kyc_id_back || !kyc_video_url) {
      throw new BadRequestException(
        'KYC requires both ID images and a verification video.',
      );
    }
    await this.usersService.updateUser(userId, {
      kyc_id_front,
      kyc_id_back,
      kyc_video_url,
      kyc_status: 'pending',
    });
    return {
      message: 'KYC submission received. Our team will review within 1–2 business days.',
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) throw new BadRequestException('Current password is incorrect');

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.updateUser(userId, { password_hash: newHash });
    return { message: 'Password updated successfully' };
  }

  async changeEmail(userId: string, newEmail: string, currentPassword: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) throw new BadRequestException('Password is incorrect');

    const existing = await this.usersService.findByEmail(newEmail);
    if (existing) throw new ConflictException('Email already taken');

    await this.usersService.updateUser(userId, { email: newEmail });
    // Return new token with updated email
    const updatedUser = await this.usersService.findById(userId);
    return this.login(updatedUser);
  }
}
