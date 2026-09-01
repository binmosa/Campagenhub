import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('brand_profiles')
export class BrandProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  company_name: string;

  @Column({ nullable: true })
  industry: string;

  @Column({ nullable: true })
  website: string;

  /** Same JSON shape as CreatorProfile.social_links ({platform: {url}}). */
  @Column({ type: 'text', nullable: true })
  social_links: string;

  /** Ad goals the brand wants to run, CSV: "Awareness, Conversions". */
  @Column({ type: 'text', nullable: true })
  objectives: string;

  @Column({ nullable: true })
  contact_person: string;

  @Column({ nullable: true })
  contact_email: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  logo_url: string;

  @Column({ nullable: true })
  tin_number: string;

  /* Structured location — same design as CreatorProfile: names for
     display, ISO codes (country_code / state_code) as stable join keys. */
  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true, length: 2 })
  country_code: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true, length: 10 })
  state_code: string;

  @Column({ nullable: true })
  city: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_manager_id' })
  manager: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
