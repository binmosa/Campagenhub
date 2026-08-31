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
  full_name: string;

  @Column({ nullable: true, unique: true })
  username: string;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  location: string;

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
