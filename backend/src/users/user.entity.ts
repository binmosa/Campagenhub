import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, ManyToOne, JoinColumn } from 'typeorm';
import { CreatorProfile } from '../creators/creator-profile.entity';
import { BrandProfile } from '../brands/brand-profile.entity';

import { ManagerProfile } from '../managers/manager-profile.entity';

export enum UserRole {
  CREATOR = 'creator',
  BRAND = 'brand',
  ADMIN = 'admin',
  SUPPORT = 'support',
  MANAGER = 'manager',
  FINANCE = 'finance',
}

/** What a creator did in onboarding beyond their profile fields. */
export type OnboardingState = {
  /** Platform ids the creator says they followed Campaign Hubz on. */
  followed?: string[];
  /** The post they published about Campaign Hubz, awaiting admin review. */
  post_url?: string;
  post_platform?: string;
  post_submitted_at?: string;
  post_status?: 'pending' | 'approved' | 'rejected';
  post_note?: string;
  post_reviewed_at?: string;
};

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  /* Password reset. The token itself is never stored — only its SHA-256
     digest — so a leaked database row cannot be replayed as a reset link.
     Both fields are cleared the moment a reset succeeds. */
  @Column({ type: 'varchar', nullable: true, select: false })
  reset_token_hash: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  reset_token_expires: Date | null;

  /** Acquisition market at signup ('et', 'root' for the global site, null
   *  for pre-tracking accounts) — cohort/attribution analytics per market. */
  @Column({ type: 'varchar', length: 8, nullable: true })
  signup_market: string | null;

  /** Preferred UI/communication language (BCP-47, e.g. 'en', 'am'). */
  @Column({ default: 'en', length: 8 })
  language: string;

  @Column({
    type: 'varchar',
    default: 'creator',
  })
  role: string;

  @OneToOne(() => CreatorProfile, profile => profile.user)
  creatorProfile: CreatorProfile;

  @OneToOne(() => BrandProfile, profile => profile.user)
  brandProfile: BrandProfile;

  @OneToOne(() => ManagerProfile, profile => profile.user)
  managerProfile: ManagerProfile;

  @Column({ type: 'text', nullable: true })
  identity_document: string; // Base64 PDF file (Legacy)

  @Column({ type: 'text', nullable: true })
  kyc_id_front: string; // Base64 Front image of ID

  @Column({ type: 'text', nullable: true })
  kyc_id_back: string; // Base64 Back image of ID

  @Column({ type: 'text', nullable: true })
  kyc_video_url: string; // Base64 WebM/MP4 Video

  @Column({ default: 'pending' })
  kyc_status: string; // pending, approved, rejected

  @Column({ default: 'pending_verification' })
  account_status: string; // pending_verification, active, rejected

  // Whether the user must complete KYC. New accounts default to false (they
  // can use the platform straight away). An admin flips this to true when a
  // user needs to verify identity — at which point the user sees a banner
  // and a KYC card in their profile and must submit ID + video.
  @Column({ type: 'boolean', default: false })
  kyc_required: boolean;

  @Column({ nullable: true })
  telegram_chat_id: string;

  @Column({ nullable: true })
  telegram_username: string;

  @Column({ nullable: true })
  telegram_connect_token: string;

  @Column({ type: 'int', default: 0 })
  points: number;

  @Column({ nullable: true, unique: true })
  referral_code: string;

  @Column({ type: 'boolean', default: false })
  is_banned: boolean;

  /* ── Creator onboarding ──────────────────────────────────────────
     A creator's first session is a short guided setup (channels →
     follow & share → done) instead of the full dashboard. `null` means
     they have not finished it yet; the portal keeps sending them back to
     /onboarding until it is set. Accounts that already had social links
     before this existed are auto-completed on their next /auth/me. */
  @Column({ type: 'timestamp', nullable: true })
  onboarding_completed_at: Date | null;

  /* ── Terms acceptance — the legal record of the onboarding agreement.
     Version + timestamp + where it came from, so a dispute can show exactly
     which text the creator accepted and when. Never cleared. */
  @Column({ type: 'timestamp', nullable: true })
  terms_accepted_at: Date | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  terms_version: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  terms_accepted_ip: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true, select: false })
  terms_accepted_user_agent: string | null;

  /** Follow + welcome-post progress captured during onboarding. */
  @Column({ type: 'simple-json', nullable: true })
  onboarding: OnboardingState | null;

  @Column({ type: 'simple-json', nullable: true })
  permissions: Record<string, boolean> | null;

  @Column({ nullable: true })
  custom_role_id: string;

  // For brand sub-users / team members
  @Column({ nullable: true })
  parent_brand_id: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_brand_id' })
  parentBrand: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
