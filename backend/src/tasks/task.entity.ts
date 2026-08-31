import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  contract_id: string; // Can be a Contract.id or an Invitation.id (team contract)

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', default: 'pending' }) // pending, in_progress, completed, reviewed
  status: string;

  @Column({ type: 'varchar', nullable: true })
  post_link: string;

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
