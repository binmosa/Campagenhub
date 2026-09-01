import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Translation } from './translation.entity';
import { LlmService } from '../ai/llm.service';

/**
 * Languages UGC is translated INTO. Only languages the UI actually renders —
 * translating into languages with no locale yet is wasted LLM spend.
 * Grow this together with frontend/src/i18n/locales/.
 */
export const TRANSLATION_LANGUAGES = ['en', 'am'];

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  am: 'Amharic',
  sw: 'Swahili',
  fr: 'French',
};

/**
 * TranslationsService — write-through machine translation of UGC.
 *
 * Model: authors write in ONE language (never forced to dual-author).
 * The original is stored untouched on its entity; this service derives
 * translated copies per target language via the OpenRouter LLM and caches
 * them in the `translations` table, keyed by a hash of the source text so
 * edits invalidate stale rows automatically.
 *
 * When the LLM is disabled (no OPENROUTER_API_KEY), everything degrades
 * gracefully: no rows are written and readers fall back to the original.
 */
@Injectable()
export class TranslationsService {
  constructor(
    @InjectRepository(Translation)
    private translationsRepository: Repository<Translation>,
    private llmService: LlmService,
  ) {}

  /**
   * Cheap language detection. Ethiopic script is unambiguous; everything
   * else defaults to English for now (script-based detection grows with
   * each added language — Latin-script pairs would need the LLM).
   */
  detectLanguage(text: string): string {
    if (/[ሀ-፿]/.test(text || '')) return 'am';
    return 'en';
  }

  hash(text: string): string {
    return createHash('sha256').update(text || '', 'utf8').digest('hex');
  }

  /** Translate one text via the LLM. Null when disabled or on failure. */
  async translate(text: string, from: string, to: string): Promise<string | null> {
    if (!this.llmService.enabled || !text?.trim()) return null;
    const fromName = LANGUAGE_NAMES[from] || from;
    const toName = LANGUAGE_NAMES[to] || to;
    const out = await this.llmService.chat(
      `You are a professional marketing translator. Translate the user's text from ${fromName} to ${toName}. ` +
        'Preserve meaning, tone, numbers, currency amounts, @handles, URLs, and brand/product names exactly. ' +
        'Do not add, omit, or explain anything. Reply with ONLY the translated text.',
      text,
      { maxTokens: 1200, temperature: 0.2 },
    );
    return out?.trim() || null;
  }

  /**
   * Ensure translations exist for an entity's fields in every target
   * language. Skips fields whose stored `source_hash` still matches
   * (nothing changed), so repeated calls are cheap. Safe to fire-and-forget.
   */
  async syncEntity(
    entityType: string,
    entityId: string,
    fields: Record<string, string | null | undefined>,
    sourceLanguage: string,
  ): Promise<void> {
    if (!this.llmService.enabled) return;

    const targets = TRANSLATION_LANGUAGES.filter((l) => l !== sourceLanguage);
    if (targets.length === 0) return;

    const existing = await this.translationsRepository.find({
      where: { entity_type: entityType, entity_id: entityId },
    });
    const byKey = new Map(existing.map((t) => [`${t.language}:${t.field}`, t]));

    for (const [field, raw] of Object.entries(fields)) {
      const text = (raw || '').trim();
      if (!text) continue;
      const sourceHash = this.hash(text);

      for (const lang of targets) {
        const row = byKey.get(`${lang}:${field}`);
        if (row && row.source_hash === sourceHash) continue; // up to date

        const translated = await this.translate(text, sourceLanguage, lang);
        if (!translated) continue; // retried by the periodic sweep

        if (row) {
          row.text = translated;
          row.source_hash = sourceHash;
          await this.translationsRepository.save(row);
        } else {
          await this.translationsRepository.save(
            this.translationsRepository.create({
              entity_type: entityType,
              entity_id: entityId,
              language: lang,
              field,
              text: translated,
              source_hash: sourceHash,
            }),
          );
        }
      }
    }
  }

  /**
   * Batch read for list endpoints: translations of `ids` in `language`,
   * as Map<entityId, { field: text }>.
   */
  async getFor(
    entityType: string,
    ids: string[],
    language: string,
  ): Promise<Map<string, Record<string, string>>> {
    const result = new Map<string, Record<string, string>>();
    if (ids.length === 0) return result;
    const rows = await this.translationsRepository.find({
      where: { entity_type: entityType, entity_id: In(ids), language },
    });
    for (const r of rows) {
      const bucket = result.get(r.entity_id) || {};
      bucket[r.field] = r.text;
      result.set(r.entity_id, bucket);
    }
    return result;
  }

  /** Remove all translations for an entity (call on delete). */
  async removeEntity(entityType: string, entityId: string): Promise<void> {
    await this.translationsRepository.delete({ entity_type: entityType, entity_id: entityId });
  }
}
