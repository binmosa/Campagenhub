import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * fx_rates — daily FX snapshot, USD-based.
 *
 * `per_usd` = units of this currency per 1 USD (e.g. ETB ≈ 140).
 * `manual_per_usd` overrides the fetched rate when set — the control lever
 * for currencies where the official/market rates diverge (ETB). Set it
 * directly in the DB (or a future admin screen); it wins until cleared.
 */
@Entity('fx_rates')
export class FxRate {
  /** ISO-4217, uppercase. */
  @PrimaryColumn({ length: 3 })
  currency: string;

  @Column({ type: 'decimal', precision: 16, scale: 6, nullable: true })
  per_usd: number;

  @Column({ type: 'decimal', precision: 16, scale: 6, nullable: true })
  manual_per_usd: number;

  @Column({ length: 32, default: 'open.er-api.com' })
  source: string;

  @Column({ type: 'timestamp', nullable: true })
  fetched_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
