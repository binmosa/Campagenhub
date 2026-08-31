import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar' })
  type: string; // APPLICATION_APPROVED, NEW_MESSAGE, CONTRACT_UPDATED

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', nullable: true })
  reference_id: string; // The ID of the application, message, or contract this relates to

  @Column({ default: false })
  is_read: boolean;

  @CreateDateColumn()
  created_at: Date;
}
