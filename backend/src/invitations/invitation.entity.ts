import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
export type InvitationType = 'creator_collab' | 'manager_assign';

@Entity('invitations')
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receiver_id' })
  receiver: User;

  // Always the brand even if a manager sends on their behalf
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'brand_id' })
  brand: User;

  @Column({ type: 'enum', enum: ['creator_collab', 'manager_assign'] })
  type: InvitationType;

  @Column({ type: 'enum', enum: ['pending', 'accepted', 'declined', 'cancelled', 'expired'], default: 'pending' })
  status: InvitationStatus;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'text', nullable: true })
  contract_content: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  payment_amount: number;

  @Column({ type: 'varchar', nullable: true, default: 'monthly' })
  payment_frequency: string;

  @Column({ type: 'int', nullable: true, default: 1 })
  payment_day: number; // Day of month / day of year

  @Column({ nullable: true, default: 'NGN' })
  currency: string;

  @Column({ type: 'simple-json', nullable: true })
  permissions: {
    can_add_campaigns?: boolean;
    can_view_analytics?: boolean;
    can_manage_applications?: boolean;
  };

  // If manager set payment terms, brand must approve before contract activates
  @Column({ type: 'boolean', default: true })
  payment_approved: boolean;

  @Column({ nullable: true })
  expires_at: Date;

  @Column({ type: 'text', nullable: true })
  video_link: string;

  @CreateDateColumn()
  created_at: Date;
}
