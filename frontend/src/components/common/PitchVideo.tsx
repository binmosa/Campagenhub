import React from 'react';
import { ExternalLink, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { serverOrigin } from '../../lib/api';

/**
 * PitchVideo — renders a creator's video pitch wherever it came from:
 * a file on this server (legacy recorder / uploads), a YouTube link (embedded),
 * or any other hosted link (Drive, TikTok, Instagram…) as an open-in-new-tab card.
 */
const YT = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i;
const FILE = /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i;

export const PitchVideo: React.FC<{ url: string; maxHeight?: number; className?: string }> = ({ url, maxHeight = 320, className = '' }) => {
  const { t } = useTranslation();
  const yt = YT.exec(url);
  if (yt) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${yt[1]}`}
        title={t('apps.video')}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className={`w-full rounded-xl v-hairline ${className}`}
        style={{ aspectRatio: '16 / 9', border: 0, background: '#0b1736' }}
      />
    );
  }
  if (url.startsWith('/') || FILE.test(url)) {
    const src = url.startsWith('/') ? `${serverOrigin}${url}` : url;
    return <video src={src} controls preload="metadata" className={`w-full rounded-xl v-hairline ${className}`} style={{ maxHeight, background: '#0b1736' }} />;
  }
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {}
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`v-talent-card p-4 flex items-center gap-3 ${className}`}>
      <span className="v-hero-icon shrink-0" style={{ width: 40, height: 40, borderRadius: 12 }}>
        <Video size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block v-ink font-medium" style={{ fontSize: 13.5 }}>{t('apps.openVideo')}</span>
        <span className="block v-caption v-quiet truncate" style={{ fontSize: 11.5 }}>{host} · {t('apps.openVideoHint')}</span>
      </span>
      <ExternalLink size={14} className="v-quiet shrink-0" />
    </a>
  );
};

export default PitchVideo;
