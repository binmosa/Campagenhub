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

  @Column({ type: 'simple-json', nullable: true })
  blacklisted_brand_ids: string[]; // List of brand User IDs that banned them

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
