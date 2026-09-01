import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brand_id' })
  brand: User;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /** The amount AS THE BRAND ENTERED IT, in `currency`. Never mutated. */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  budget: number;

  /** ISO-4217 currency of the budget (multi-market: ETB, NGN, USD, …). */
  @Column({ length: 3, default: 'USD' })
  currency: string;

  /** Canonical USD value — the ledger truth for filters, escrow, analytics.
   *  Computed ONCE at post time from the day's rate; never floats. */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  budget_usd: number;

  /** Units of `currency` per USD, locked when the campaign was posted. */
  @Column({ type: 'decimal', precision: 16, scale: 6, nullable: true })
  fx_rate: number;

  @Column({ type: 'timestamp', nullable: true })
  fx_rate_at: Date;

  /** Detected language the brand wrote the brief in ('en', 'am', …). */
  @Column({ length: 8, nullable: true })
  source_language: string;

  @Column({ nullable: true })
  platform: string;

  @Column({ type: 'text', nullable: true })
  target_audience: string;

  /** Content orientation, e.g. Photo / Video / Story / Reel */
  @Column({ nullable: true })
  content_type: string;

  /** Campaign orientation, e.g. Awareness / Engagement / Conversions */
  @Column({ nullable: true })
  objective: string;

  @Column({ type: 'date', nullable: true })
  deadline: Date;

  @Column({ type: 'varchar', default: 'draft' }) // draft, active, closed
  status: string;

  @Column({ type: 'text', nullable: true })
  cover_image: string;

  @Column({ type: 'text', nullable: true })
  contract_template: string;

  @Column({ type: 'boolean', default: false })
  post_to_telegram: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
