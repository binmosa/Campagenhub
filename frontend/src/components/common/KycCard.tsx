import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  ShieldCheck,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { Button, Card, Chip, Label, Separator } from '@heroui/react';
import { VideoPitchRecorder } from './VideoPitchRecorder';
import api from '../../lib/api';

/**
 * KycCard — identity verification card embedded in each role's profile page.
 *
 * Self-renders three states based on the user's current KYC posture:
 *   1. **Approved** — small "Verified" success chip, no form.
 *   2. **Submitted, under review** — read-only "we're reviewing" message
 *      with a chip showing the pending status.
 *   3. **Required, not yet submitted** — full form (ID front, ID back,
 *      verification video) plus Submit button.
 *
 * The card decides which state to show from the `user` object returned by
 * `/auth/me` (specifically `kyc_required`, `kyc_status`, `has_kyc_submission`).
 * If `kyc_required` is `false` AND status isn't approved, the card hides
 * itself entirely — users who haven't been asked to KYC don't need to see it.
 *
 * Pass `forceShow=true` to render the card even when not required (e.g. if
 * you want to give the user a "Verify proactively" option).
 */
interface KycCardProps {
  user: {
    role?: string; kyc_required?: boolean;
    kyc_status?: string;
    has_kyc_submission?: boolean;
  } | null;
  onSubmitted?: () => void;
  forceShow?: boolean;
}

export const KycCard: React.FC<KycCardProps> = ({
  user,
  onSubmitted,
  forceShow,
}) => {
  const [idFront, setIdFront] = useState('');
  const [idBack, setIdBack] = useState('');
  const [videoB64, setVideoB64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Reset local state if the parent user object changes after a refresh
  useEffect(() => {
    if (user?.kyc_status === 'approved') {
      setIdFront('');
      setIdBack('');
      setVideoB64(null);
      setSuccess(false);
      setError('');
    }
  }, [user?.kyc_status]);

  const required = !!user?.kyc_required;
  const approved = user?.kyc_status === 'approved';
  const submitted = user?.has_kyc_submission && user?.kyc_status === 'pending';

  // Hide entirely if not required and not approved (default state).
  if (!forceShow && !required && !approved) return null;

  // ── Approved — one quiet strip, not a card
  if (approved) {
    return (
      <div
        className="rounded-xl px-4 py-2.5 flex items-center gap-3"
        style={{ background: 'rgba(22,199,132,0.08)', border: '1px solid rgba(22,199,132,0.25)' }}
      >
        <ShieldCheck size={16} style={{ color: 'var(--color-signal-green)' }} className="shrink-0" />
        <div className="flex-1 min-w-0 v-body" style={{ fontSize: 13 }}>
          <span className="v-ink font-medium">Identity verified.</span>{' '}
          <span className="v-muted">{user?.role === 'brand' ? 'Creators see a verified badge on your briefs.' : 'Brands see a verified badge on your profile.'}</span>
        </div>
        <Chip color="success" variant="soft" size="sm">
          <CheckCircle2 size={11} />
          <Chip.Label>Verified</Chip.Label>
        </Chip>
      </div>
    );
  }

  // ── Submitted, under review
  if (submitted) {
    return (
      <div
        className="rounded-xl px-4 py-2.5 flex items-center gap-3"
        style={{ background: 'rgba(255,181,71,0.12)', border: '1px solid rgba(255,181,71,0.35)' }}
      >
        <Clock size={16} style={{ color: '#b45309' }} className="shrink-0" />
        <div className="flex-1 min-w-0 v-body" style={{ fontSize: 13 }}>
          <span className="v-ink font-medium">Verification under review.</span>{' '}
          <span className="v-muted">Our team is reviewing your documents — you'll hear back within 1–2 business days.</span>
        </div>
        <Chip color="warning" variant="soft" size="sm">
          <Clock size={11} />
          <Chip.Label>Pending</Chip.Label>
        </Chip>
      </div>
    );
  }

  // ── Required, not yet submitted — full form
  const resizeImage = (file: File, callback: (b64: string) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.8));
      };
      if (e.target?.result) img.src = e.target.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleUpload =
    (side: 'front' | 'back') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      resizeImage(file, (b64) =>
        side === 'front' ? setIdFront(b64) : setIdBack(b64)
      );
    };

  const handleSubmit = async () => {
    if (!idFront || !idBack) {
      setError('Please upload both the front and back of your ID.');
      return;
    }
    if (!videoB64) {
      setError('Please record a short verification video.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/auth/kyc', {
        kyc_id_front: idFront,
        kyc_id_back: idBack,
        kyc_video_url: videoB64,
      });
      setSuccess(true);
      onSubmitted?.();
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          'Failed to submit KYC. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-warning/40">
      <Card.Header>
        <Card.Title className="inline-flex items-center gap-2 text-base">
          <ShieldCheck size={15} className="text-warning" />
          Verify your identity
        </Card.Title>
        <Card.Description>
          Upload your ID and record a short verification video. Your account
          stays usable while we review — usually within 1–2 business days.
        </Card.Description>
      </Card.Header>
      <Separator />
      <Card.Content className="p-5 space-y-5">
        {/* ID images */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(['front', 'back'] as const).map((side) => {
            const value = side === 'front' ? idFront : idBack;
            return (
              <div key={side}>
                <Label className="text-muted text-[10px] font-medium uppercase tracking-wider block mb-1.5 inline-flex items-center gap-1.5">
                  <FileText size={11} /> {side === 'front' ? 'Front of ID' : 'Back of ID'}
                </Label>
                {value ? (
                  <div className="relative rounded-xl overflow-hidden border border-border aspect-video bg-surface-secondary">
                    <img
                      src={value}
                      alt={`ID ${side}`}
                      className="w-full h-full object-contain"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      aria-label={`Remove ID ${side}`}
                      className="!absolute top-2 right-2 !bg-surface/80 backdrop-blur-sm"
                      onPress={() =>
                        side === 'front' ? setIdFront('') : setIdBack('')
                      }
                    >
                      <X size={13} />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-border rounded-xl bg-surface-secondary hover:bg-surface cursor-pointer transition-colors">
                    <Upload size={22} className="text-muted mb-2" />
                    <span className="text-foreground text-sm font-medium">
                      Click to upload
                    </span>
                    <span className="text-muted text-xs mt-1">
                      PNG / JPG up to 5MB
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUpload(side)}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Video */}
        <div>
          <Label className="text-muted text-[10px] font-medium uppercase tracking-wider block mb-2 inline-flex items-center gap-1.5">
            <Video size={11} /> Verification video
          </Label>
          <p className="text-muted text-xs mb-3">
            Record a 5–15 second clip turning your head left then right to prove
            you're a real person.
          </p>
          <VideoPitchRecorder
            onRecordingComplete={(b64) => setVideoB64(b64)}
            maxDuration={20}
          />
        </div>

        {/* Error */}
        {error && (
          <Card className="bg-danger-soft border-danger/40">
            <Card.Content className="p-3 flex items-center gap-2 text-sm font-medium text-danger-soft-foreground">
              <AlertCircle size={13} /> {error}
            </Card.Content>
          </Card>
        )}

        {success && (
          <Card className="bg-success-soft border-success/40">
            <Card.Content className="p-3 flex items-center gap-2 text-sm font-medium text-success-soft-foreground">
              <CheckCircle2 size={13} /> Submitted! Our team will review within
              1–2 business days.
            </Card.Content>
          </Card>
        )}

        <Separator />

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="md"
            isPending={submitting}
            isDisabled={!idFront || !idBack || !videoB64 || success}
            onPress={handleSubmit}
          >
            <ShieldCheck size={13} /> Submit for verification
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
};

export default KycCard;
