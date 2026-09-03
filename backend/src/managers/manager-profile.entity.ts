import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('manager_profiles')
export class ManagerProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  first_name: string;

  @Column({ nullable: true })
  last_name: string;

  /** Derived display name (first + last) — kept in sync on write. */
  @Column({ nullable: true })
  full_name: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 5.0 })
  rating: number;

  @Column({ type: 'text', nullable: true })
  avatar_url: string;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  specialty: string; // niche/area of expertise e.g. "Fashion, SaaS, E-commerce"

  @Column({ type: 'int', nullable: true, default: 0 })
  experience_years: number;

  /* Structured location (ISO codes) — same shape as creator profiles so
     the talent directory can filter managers by place. `location` stays
     the derived display string. */
  @Column({ nullable: true })
  country: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  country_code: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  state_code: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  website: string;

  /** Comma-separated service list, e.g. "Campaign strategy, Creator sourcing". */
  @Column({ type: 'text', nullable: true })
  services: string;

  /** Comma-separated languages the manager works in. */
  @Column({ nullable: true })
  languages: string;

  @Column({ type: 'simple-json', nullable: true })
  blacklisted_brand_ids: string[]; // List of brand User IDs that banned them

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
