import api from './api';

/**
 * telegram — the bot identity comes from the backend (`TELEGRAM_BOT_USERNAME`
 * in .env), never hardcoded in the frontend. Swap bots by updating .env and
 * restarting; every t.me link follows automatically.
 */

let cached: string | null = null;

export const getTelegramBotUsername = async (): Promise<string> => {
  if (cached !== null) return cached;
  try {
    const res = await api.get('/telegram/bot-info');
    cached = typeof res.data?.username === 'string' ? res.data.username : '';
  } catch {
    cached = '';
  }
  return cached ?? '';
};

export const buildTelegramLink = (username: string, startParam?: string): string =>
  username ? `https://t.me/${username}${startParam ? `?start=${startParam}` : ''}` : '';
