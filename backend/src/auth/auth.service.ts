import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../users/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatorProfile } from '../creators/creator-profile.entity';
import { BrandProfile } from '../brands/brand-profile.entity';
import { ManagerProfile } from '../managers/manager-profile.entity';
import { withDerivedFullName } from '../core/name.util';
import { EmailService } from '../email/email.service';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** The roles a stranger may give themselves through public registration. */
const SELF_SIGNUP_ROLES: UserRole[] = [UserRole.CREATOR, UserRole.BRAND, UserRole.MANAGER];

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(CreatorProfile) private readonly creatorProfiles: Repository<CreatorProfile>,
    @InjectRepository(BrandProfile) private readonly brandProfiles: Repository<BrandProfile>,
    @InjectRepository(ManagerProfile) private readonly managerProfiles: Repository<ManagerProfile>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly emailService: EmailService,
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
    language?: string,
    signupMarket?: string,
  ) {
    if (typeof pass !== 'string' || pass.length < 8) {
      throw new BadRequestException('Your password needs at least 8 characters.');
    }

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // Defaulting to 10 rounds for speed in MVP
    const password_hash = await bcrypt.hash(pass, 10);
    const telegram_connect_token = require('crypto').randomBytes(8).toString('hex');

    const normalizedRole = (role || '').toLowerCase().trim();

    // Only the three self-service roles may be claimed at signup. Staff
    // roles (admin, support, finance) exist solely to be handed out by an
    // admin from POST /admin/users — without this allowlist anyone could
    // register with `role: "admin"` and walk into the whole back office.
    if (!SELF_SIGNUP_ROLES.includes(normalizedRole as UserRole)) {
      throw new BadRequestException('Choose one of: creator, brand, manager.');
    }

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
      language: typeof language === 'string' && language.trim() ? language.trim().slice(0, 8) : 'en',
      signup_market:
        typeof signupMarket === 'string' && /^([a-z]{2}|root)$/.test(signupMarket.trim())
          ? signupMarket.trim()
          : null,
    });

    try {
      // Create role profile immediately (so UI has something to load once approved)
      if (normalizedRole === 'creator') {
        const rawUsername = typeof profile?.username === 'string' ? profile.username.trim() : '';
        const creatorPayload = {
          ...withDerivedFullName({ ...(profile || {}) }),
          username: rawUsername || null,
        };
        await this.creatorProfiles.save(this.creatorProfiles.create({ user: { id: user.id } as any, ...creatorPayload }));
      }
      if (normalizedRole === 'brand') {
        await this.brandProfiles.save(this.brandProfiles.create({ user: { id: user.id } as any, ...(profile || {}) }));
      }
      if (normalizedRole === 'manager') {
        await this.managerProfiles.save(this.managerProfiles.create({ user: { id: user.id } as any, ...withDerivedFullName({ ...(profile || {}) }) }));
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

    // These three are base64 blobs stored on the user row. Without a type
    // and size check the 50 MB body limit is an invitation to write tens of
    // megabytes of arbitrary content into `users` on every call.
    const assertMedia = (value: string, label: string, kinds: RegExp, maxBase64: number) => {
      if (!kinds.test(value)) {
        throw new BadRequestException(`${label} must be an image or video upload.`);
      }
      if (value.length > maxBase64) {
        throw new BadRequestException(`${label} is too large — please upload a smaller file.`);
      }
    };
    const IMAGE = /^data:image\/(png|jpe?g|webp);base64,/i;
    const VIDEO = /^(https?:\/\/|data:video\/(mp4|webm|quicktime);base64,)/i;
    assertMedia(kyc_id_front, 'The front of your ID', IMAGE, 8_000_000);
    assertMedia(kyc_id_back, 'The back of your ID', IMAGE, 8_000_000);
    assertMedia(kyc_video_url, 'Your verification video', VIDEO, 34_000_000);
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

  /* ── Password reset ───────────────────────────────────────────────
   *
   * A locked-out user had no way back in: the login page's "Forgot
   * password?" pointed at nothing and no endpoint existed.
   *
   * The token is random, single-use and short-lived. Only its digest is
   * stored, and the request endpoint answers identically whether or not
   * the address is registered — otherwise it doubles as a way to discover
   * who has an account here.
   */
  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async requestPasswordReset(email: string): Promise<{ ok: true }> {
    const address = String(email || '').trim().toLowerCase();
    const done = { ok: true } as const;
    if (!address) return done;

    const user = await this.usersService.findByEmail(address);
    if (!user || user.is_banned) return done;

    const token = randomBytes(32).toString('hex');
    await this.users.update(user.id, {
      reset_token_hash: this.hashResetToken(token),
      reset_token_expires: new Date(Date.now() + 60 * 60 * 1000),
    });

    const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const resetUrl = `${base}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    const sent = await this.emailService.sendPasswordReset(user.email, resetUrl);
    if (!sent) {
      // No mail credentials configured (local dev): the link still has to
      // reach someone, so it goes to the server log and nowhere else.
      console.log(`[Auth] Password reset link for ${user.email}: ${resetUrl}`);
    }
    return done;
  }

  async resetPassword(email: string, token: string, newPassword: string) {
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new BadRequestException('Your new password needs at least 8 characters.');
    }
    const address = String(email || '').trim().toLowerCase();
    const expired = new BadRequestException('That reset link has expired or has already been used. Ask for a new one.');
    if (!address || !token) throw expired;

    const user = await this.users.findOne({
      where: { email: address },
      select: ['id', 'email', 'reset_token_hash', 'reset_token_expires'],
    });
    if (!user?.reset_token_hash || !user.reset_token_expires) throw expired;
    if (user.reset_token_expires.getTime() < Date.now()) throw expired;

    const given = Buffer.from(this.hashResetToken(String(token)));
    const stored = Buffer.from(user.reset_token_hash);
    if (given.length !== stored.length || !timingSafeEqual(given, stored)) throw expired;

    await this.users.update(user.id, {
      password_hash: await bcrypt.hash(newPassword, 10),
      reset_token_hash: null,
      reset_token_expires: null,
    });
    return { ok: true, message: 'Your password has been changed. You can sign in with it now.' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) throw new BadRequestException('Current password is incorrect');
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new BadRequestException('Your new password needs at least 8 characters.');
    }

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
