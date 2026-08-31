import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { Application } from '../applications/application.entity';

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: Application;

  @Column({ type: 'varchar', default: 'draft' }) // draft, pending_signature, approved, rejected
  status: string;

  @Column({ type: 'text', nullable: true })
  terms: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  payment_amount: number;

  @Column({ type: 'varchar', nullable: true })
  contract_length: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
