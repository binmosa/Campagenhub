import React, { useState } from 'react';
import { CheckCircle2, Copy, Sparkles } from 'lucide-react';
import { Button, Modal } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';

/**
 * PitchModal — the AI pitch helper used when writing an offer. A HeroUI
 * modal so it portals and stacks above whichever modal opened it (the old
 * hand-rolled overlay rendered underneath the offer dialog's backdrop).
 */
interface PitchModalProps {
  onClose: () => void;
  defaultCampaignName?: string;
  defaultCreatorName?: string;
}

const TONES = ['professional', 'casual', 'enthusiastic', 'humorous', 'persuasive'] as const;
const TONE_VALUE: Record<(typeof TONES)[number], string> = {
  professional: 'Professional',
  casual: 'Casual',
  enthusiastic: 'Enthusiastic',
  humorous: 'Humorous',
  persuasive: 'Persuasive',
};

const fieldClass = 'w-full px-3.5 py-2.5 rounded-lg v-body v-ink';
const fieldStyle: React.CSSProperties = { background: '#fff', border: '1px solid var(--color-cool-gray)' };
const labelClass = 'v-caption v-quiet font-medium uppercase tracking-wider block mb-1.5';

export const PitchModal: React.FC<PitchModalProps> = ({ onClose, defaultCampaignName = '', defaultCreatorName = '' }) => {
  const { t } = useTranslation();
  const [campaignName, setCampaignName] = useState(defaultCampaignName);
  const [creatorName, setCreatorName] = useState(defaultCreatorName);
  const [targetAudience, setTargetAudience] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [tone, setTone] = useState<(typeof TONES)[number]>('professional');
  const [loading, setLoading] = useState(false);
  const [pitchResult, setPitchResult] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [error, setError] = useState('');

  const generatePitch = async () => {
    if (!campaignName.trim() || !targetAudience.trim()) {
      setError(t('pitchGen.errRequired'));
      return;
    }
    setError('');
    setLoading(true);
    setPitchResult([]);
    try {
      const res = await api.post('/pitch', { campaignName, creatorName, targetAudience, keyPoints, tone: TONE_VALUE[tone] });
      const pitches: string[] = Array.isArray(res.data?.pitches) ? res.data.pitches.filter(Boolean) : [];
      if (pitches.length) setPitchResult(pitches);
      else setError(t('pitchGen.errEmpty'));
    } catch (e: any) {
      setError(e.response?.data?.message || t('pitchGen.errFailed'));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <Sparkles size={16} style={{ color: 'var(--color-campaign-purple)' }} /> {t('pitchGen.title')}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <p className="v-body v-muted" style={{ fontSize: 13 }}>{t('pitchGen.desc')}</p>
                {error && (
                  <div role="alert" className="rounded-lg p-3 v-body" style={{ background: 'rgba(255,90,95,0.08)', border: '1px solid rgba(255,90,95,0.25)', color: '#b3261e', fontSize: 12.5 }}>
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="pitch-gen-campaign" className={labelClass}>{t('pitchGen.campaign')} *</label>
                    <input id="pitch-gen-campaign" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder={t('pitchGen.campaignPh')} className={fieldClass} style={fieldStyle} />
                  </div>
                  <div>
                    <label htmlFor="pitch-gen-name" className={labelClass}>{t('pitchGen.name')}</label>
                    <input id="pitch-gen-name" value={creatorName} onChange={(e) => setCreatorName(e.target.value)} placeholder={t('pitchGen.namePh')} className={fieldClass} style={fieldStyle} />
                  </div>
                </div>
                <div>
                  <label htmlFor="pitch-gen-audience" className={labelClass}>{t('pitchGen.audience')} *</label>
                  <input id="pitch-gen-audience" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder={t('pitchGen.audiencePh')} className={fieldClass} style={fieldStyle} />
                </div>
                <div>
                  <label htmlFor="pitch-gen-points" className={labelClass}>{t('pitchGen.points')}</label>
                  <textarea id="pitch-gen-points" rows={3} value={keyPoints} onChange={(e) => setKeyPoints(e.target.value)} placeholder={t('pitchGen.pointsPh')} className={`${fieldClass} resize-none`} style={fieldStyle} />
                </div>
                <div>
                  <span className={labelClass}>{t('pitchGen.tone')}</span>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('pitchGen.tone')}>
                    {TONES.map((k) => (
                      <button key={k} type="button" role="radio" aria-checked={tone === k} className="v-niche-chip" data-active={tone === k || undefined} onClick={() => setTone(k)}>
                        {t(`pitchGen.tones.${k}`)}
                      </button>
                    ))}
                  </div>
                </div>

                {pitchResult.length > 0 && (
                  <div className="space-y-2.5 pt-1">
                    <div className="v-caption v-quiet font-medium uppercase tracking-wider">{t('pitchGen.results')}</div>
                    {pitchResult.map((pitch, idx) => (
                      <div key={idx} className="relative rounded-xl p-3.5 pr-12 v-body v-ink whitespace-pre-wrap" style={{ background: 'rgba(244,242,255,0.5)', border: '1px solid var(--color-cool-gray)', fontSize: 13, lineHeight: 1.6 }}>
                        {pitch}
                        <button
                          type="button"
                          onClick={() => copyToClipboard(pitch, idx)}
                          aria-label={copiedIndex === idx ? t('pitchGen.copied') : t('pitchGen.copy')}
                          className="absolute top-3 right-3 v-shell-btn"
                          style={{ width: 32, height: 32 }}
                        >
                          {copiedIndex === idx ? <CheckCircle2 size={14} style={{ color: 'var(--color-signal-green)' }} /> : <Copy size={14} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose}>{t('common.close')}</Button>
              <Button variant="primary" onPress={generatePitch} isPending={loading}>
                <Sparkles size={13} /> {pitchResult.length ? t('pitchGen.again') : t('pitchGen.generate')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

export default PitchModal;
