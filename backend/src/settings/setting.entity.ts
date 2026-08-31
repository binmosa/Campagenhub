import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity()
export class PlatformSetting {
  @PrimaryColumn()
  key: string;

  @Column({ type: 'text' })
  value: string;
}
