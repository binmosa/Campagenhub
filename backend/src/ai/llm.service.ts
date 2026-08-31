import { Injectable, OnModuleInit } from '@nestjs/common';
import axios from 'axios';

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'deepseek/deepseek-chat';

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
}

/**
 * Thin OpenRouter client (OpenAI-compatible /chat/completions).
 * Model is provider-agnostic: any OpenRouter slug works (deepseek/*, qwen/*, ...).
 * When OPENROUTER_API_KEY is unset, every call returns null and callers
 * degrade to their template fallbacks — the app never does local inference.
 */
@Injectable()
export class LlmService implements OnModuleInit {
  private readonly apiKey = process.env.OPENROUTER_API_KEY || '';
  private readonly baseUrl = process.env.LLM_BASE_URL || DEFAULT_BASE_URL;
  readonly model = process.env.LLM_MODEL || DEFAULT_MODEL;

  get enabled(): boolean {
    return !!this.apiKey;
  }

  onModuleInit() {
    console.log(
      this.enabled
        ? `[AI] llm: openrouter/${this.model}`
        : '[AI] llm: disabled — set OPENROUTER_API_KEY to enable AI features (template fallbacks active)',
    );
  }

  /** Chat completion. Returns trimmed text, or null when disabled or the API fails. */
  async chat(systemMsg: string, userMsg: string, opts: ChatOptions = {}): Promise<string | null> {
    if (!this.enabled) return null;

    const payload = {
      model: this.model,
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg },
      ],
      max_tokens: opts.maxTokens ?? 500,
      temperature: opts.temperature ?? 0.7,
    };

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await axios.post(`${this.baseUrl}/chat/completions`, payload, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60_000,
        });
        const text = res.data?.choices?.[0]?.message?.content;
        if (typeof text === 'string' && text.trim()) return text.trim();
        return null;
      } catch (err: any) {
        if (attempt === 1) {
          console.error(
            '[AI] LLM request failed:',
            err?.response?.data?.error?.message || err?.message,
          );
        }
      }
    }
    return null;
  }

  /** Chat and parse the first JSON object/array found in the reply. Null on any failure. */
  async chatJson<T = any>(
    systemMsg: string,
    userMsg: string,
    opts: ChatOptions = {},
  ): Promise<T | null> {
    const text = await this.chat(systemMsg, userMsg, { temperature: 0.3, ...opts });
    if (!text) return null;
    try {
      const cleaned = text.replace(/```(?:json)?/gi, '');
      const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
      if (!match) return null;
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}
