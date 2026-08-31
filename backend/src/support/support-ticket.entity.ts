import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sender_name: string;

  @Column()
  sender_email: string;

  @Column({ nullable: true })
  subject: string;

  @Column('text')
  message: string;

  @Column({ type: 'varchar', default: 'open' }) // open | in_progress | resolved
  status: string;

  @Column({ type: 'text', nullable: true })
  admin_reply: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
