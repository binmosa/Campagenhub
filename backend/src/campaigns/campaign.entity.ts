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

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  budget: number;

  @Column({ nullable: true })
  platform: string;

  @Column({ type: 'text', nullable: true })
  target_audience: string;

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
