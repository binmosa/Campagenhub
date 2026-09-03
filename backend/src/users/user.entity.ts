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

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

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
