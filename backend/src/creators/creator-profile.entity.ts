import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('creator_profiles')
export class CreatorProfile {
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

  @Column({ nullable: true, unique: true })
  username: string;

  @Column({ nullable: true })
  category: string;

  /** Display string, derived from city + country ("Lagos, Nigeria"). */
  @Column({ nullable: true })
  location: string;

  /* Structured location — populated from the ISO country/state/city
     dataset via dropdowns (no free text), used for exact filtering.
     Names are stored for display; ISO codes are the stable join keys
     (cities have no ISO standard, so the canonical city NAME within
     country_code+state_code is the key — same as the upstream dataset). */
  @Column({ nullable: true })
  country: string;

  /** ISO-3166-1 alpha-2, e.g. "NG" */
  @Column({ nullable: true, length: 2 })
  country_code: string;

  @Column({ nullable: true })
  state: string;

  /** ISO-3166-2 subdivision code within the country, e.g. "LA" */
  @Column({ nullable: true, length: 10 })
  state_code: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  follower_range: string;

  @Column({ type: 'text', nullable: true })
  social_links: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ type: 'text', nullable: true })
  avatar_url: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
