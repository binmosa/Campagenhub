import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { Application } from '../applications/application.entity';

@Entity('payment_transactions')
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  tx_ref: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', default: 'flutterwave' })
  payment_method: string; // flutterwave | paypal | telebirr

  @Column({ type: 'varchar', default: 'initiated' })
  status: string; // initiated | processing | completed | failed | refunded

  @Column({ nullable: true })
  provider_reference: string;

  @Column({ type: 'text', nullable: true })
  provider_response: string; // JSON response from provider

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payer_id' })
  payer: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payee_id' })
  payee: User;

  @ManyToOne(() => Campaign, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @ManyToOne(() => Application, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'application_id' })
  application: Application;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
