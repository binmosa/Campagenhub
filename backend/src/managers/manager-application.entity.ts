import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';

/**
 * An account manager offering to run one of a brand's campaigns.
 *
 * This is the manager's way in: they cannot browse a brand's talent or
 * spend its money until a brand accepts one of these and grants them a
 * budget. Accepting creates the engagement (a BrandTeam row with a grant)
 * scoped to that campaign.
 */
@Entity('manager_applications')
@Unique(['manager', 'campaign'])
export class ManagerApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'manager_id' })
  manager: User;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brand_id' })
  brand: User;

  @Column({ type: 'text', nullable: true })
  pitch: string;

  /** What the manager asks to be paid for running the campaign. */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  proposed_fee: number | null;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', default: 'one_time' })
  fee_frequency: string;

  @Column({ type: 'varchar', default: 'pending' }) // pending | accepted | rejected | withdrawn
  status: string;

  @Column({ type: 'text', nullable: true })
  decision_note: string | null;

  @Column({ type: 'timestamp', nullable: true })
  decided_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
