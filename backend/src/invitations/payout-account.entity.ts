import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('payout_accounts')
export class PayoutAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: ['bank', 'mobile_money'], default: 'bank' })
  account_type: 'bank' | 'mobile_money';

  // Bank fields
  @Column({ nullable: true })
  bank_name: string;

  @Column({ nullable: true })
  bank_code: string; // Flutterwave bank code

  @Column({ nullable: true })
  account_number: string;

  @Column({ nullable: true })
  account_name: string; // Auto-filled via verification

  // Mobile money fields
  @Column({ nullable: true })
  mobile_number: string;

  @Column({ nullable: true })
  mobile_network: string; // MTN, Airtel, etc.

  // Common
  @Column({ nullable: true, default: 'NG' })
  country: string;

  @Column({ nullable: true, default: 'NGN' })
  currency: string;

  @Column({ type: 'boolean', default: false })
  is_verified: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
