import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'int', default: 5 })
  rating: number; // 1-5

  @Column('text')
  comment: string;

  @Column({ default: true })
  is_visible: boolean;

  @Column({ nullable: true })
  user_name: string; // Cached for display

  @Column({ nullable: true })
  user_role: string; // Cached for display (creator/brand)

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
