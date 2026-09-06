import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  contract_id: string; // Can be a Contract.id or an Invitation.id (team contract)

  /** The campaign this deliverable belongs to (null for team/invitation contracts). */
  @ManyToOne(() => Campaign, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign | null;

  @Column({ type: 'varchar', nullable: true })
  application_id: string | null;

  /** Where the deliverable is published, e.g. Instagram / TikTok. */
  @Column({ type: 'varchar', nullable: true })
  platform: string | null;

  /** 'brief' = copied from the campaign's task list at lock-in, 'manual' = assigned in the workspace. */
  @Column({ type: 'varchar', default: 'manual' })
  source: string;

  @Column({ type: 'varchar', nullable: true })
  template_key: string | null;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', default: 'pending' }) // pending, in_progress, completed, reviewed
  status: string;

  @Column({ type: 'varchar', nullable: true })
  post_link: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assigned_by' })
  assignedBy: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assigned_to' })
  assignedTo: User;

  @Column({ type: 'date', nullable: true })
  due_date: Date;

  @Column({ type: 'text', nullable: true })
  ai_review: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
