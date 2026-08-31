import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';

@Entity('applications')
@Unique(['campaign', 'creator'])
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ type: 'text', nullable: true })
  pitch: string;

  @Column({ type: 'varchar', default: 'pending' }) // pending, accepted, rejected
  status: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  payment_amount: number;

  @Column({ type: 'varchar', length: 3, nullable: true, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', nullable: true, default: 'monthly' })
  payment_frequency: string;

  @Column({ type: 'int', nullable: true, default: 1 })
  payment_day: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', nullable: true })
  video_pitch_url: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
