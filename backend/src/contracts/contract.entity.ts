import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Application } from '../applications/application.entity';

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Application, (a) => a.contracts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: Application;

  /** 'main' = the signed collaboration agreement; 'addendum' = an extra-work proposal on top of it. */
  @Column({ type: 'varchar', length: 12, default: 'main' })
  kind: string;

  /** For addenda: the main contract they extend. */
  @Column({ type: 'varchar', nullable: true })
  parent_id: string | null;

  /** For addenda: what the extra work is, in a line. */
  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  scope: string | null;

  /** For addenda: deliverables that become tasks once accepted. */
  @Column({ type: 'simple-json', nullable: true })
  tasks: { key: string; title: string; description?: string; platform?: string; due_days?: number }[] | null;

  /** draft → pending_signature ⇄ countered → active | rejected → ended */
  @Column({ type: 'varchar', default: 'draft' })
  status: string;

  /** The agreement text the brand sent (see agreement.ts); amendments are appended. */
  @Column({ type: 'text', nullable: true })
  terms: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  payment_amount: number;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency: string | null;

  @Column({ type: 'varchar', nullable: true })
  payment_frequency: string | null;

  @Column({ type: 'int', nullable: true })
  payment_day: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', nullable: true })
  contract_length: string;

  /** Recurring fees run until this date; the sweeper ends the contract the day after. */
  @Column({ type: 'date', nullable: true })
  ends_at: string | null;

  /** When the brand (last) sent these terms for signature. */
  @Column({ type: 'timestamp', nullable: true })
  offered_at: Date | null;

  /** When both sides had accepted — the contract became active. */
  @Column({ type: 'timestamp', nullable: true })
  signed_at: Date | null;

  /** Open counter-offer from the creator, cleared once answered. */
  @Column({ type: 'simple-json', nullable: true })
  counter: {
    payment_amount: number;
    currency: string;
    payment_frequency: string;
    payment_day?: number | null;
    ends_at?: string | null;
    note?: string | null;
    by: 'creator' | 'brand';
    at: string;
  } | null;

  /** Audit trail of everything that happened to this agreement. */
  @Column({ type: 'simple-json', nullable: true })
  history: {
    at: string;
    by: 'brand' | 'creator' | 'system';
    action: 'offered' | 'countered' | 'counter_accepted' | 'counter_declined' | 'signed' | 'declined' | 'withdrawn' | 'ended';
    payment_amount?: number;
    currency?: string;
    payment_frequency?: string;
    payment_day?: number | null;
    note?: string | null;
  }[] | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
