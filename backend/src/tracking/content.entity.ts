import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Application } from '../applications/application.entity';

@Entity('content_submissions')
export class ContentSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: Application;

  @Column()
  url: string;

  @Column({ default: 'pending' }) // pending, verifying, verified, flagged
  ai_verification_status: string;

  @Column({ type: 'simple-json', nullable: true })
  metrics: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    engagement_rate?: string;
  };

  @Column({ type: 'text', nullable: true })
  ai_notes: string;

  @Column({ type: 'text', nullable: true })
  platform: string; // instagram, tiktok, etc

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
