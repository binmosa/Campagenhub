import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('brand_teams')
export class BrandTeam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brand_id' })
  brand: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member: User;

  @Column({ type: 'enum', enum: ['creator', 'manager'] })
  member_type: 'creator' | 'manager';

  @Column({ nullable: true })
  invitation_id: string;

  @Column({ nullable: true })
  contract_id: string;

  @Column({ type: 'simple-json', nullable: true })
  permissions: {
    can_add_campaigns?: boolean;
    can_view_analytics?: boolean;
    can_manage_applications?: boolean;
  };

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  payment_amount: number;

  @Column({ type: 'varchar', nullable: true, default: 'monthly' })
  payment_frequency: string;

  @Column({ type: 'int', nullable: true, default: 1 })
  payment_day: number;

  @Column({ nullable: true, default: 'NGN' })
  currency: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  joined_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  removed_at: Date;

  @Column({ type: 'text', nullable: true })
  removal_reason: string;
}
