import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * translations — machine translations of user-generated content.
 *
 * Polymorphic: one table serves campaigns, bios, reviews, … as languages
 * are added. The ORIGINAL text always lives on its own entity and stays
 * the source of truth; rows here are derived display copies.
 *
 * `source_hash` is a sha256 of the original text at translation time —
 * when the author edits, hashes stop matching and the row is re-generated.
 */
@Entity('translations')
@Index(['entity_type', 'entity_id', 'language', 'field'], { unique: true })
export class Translation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** e.g. 'campaign', 'creator_profile' */
  @Column({ length: 32 })
  entity_type: string;

  @Column({ length: 64 })
  entity_id: string;

  /** BCP-47 target language, e.g. 'am', 'en' */
  @Column({ length: 8 })
  language: string;

  /** Field on the source entity, e.g. 'title', 'description', 'bio' */
  @Column({ length: 32 })
  field: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ length: 64 })
  source_hash: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
