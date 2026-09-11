import React, { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { Button, Modal } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { toast } from '../../lib/toast';
import { parseSocialLinks, serializeSocialLinks, type SocialMap } from '../../lib/socialLinks';
import { PlatformPicker } from './PlatformPicker';

/**
 * AddPlatformsModal — "I only linked Instagram at signup; now add X."
 *
 * Opens from the creator dashboard, shows the same picker as onboarding
 * (existing platforms already switched on), and saves straight to the
 * profile. Verification state on untouched platforms is preserved; new or
 * changed handles come back as unverified for the team to check.
 */
export const AddPlatformsModal: React.FC<{
  open: boolean;
  onClose: () => void;
  /** The raw `social_links` value from the profile. */
  socialLinks: string | null | undefined;
  /** Called after a successful save so the caller can reload the profile. */
  onSaved: () => void;
}> = ({ open, onClose, socialLinks, onSaved }) => {
  const { t } = useTranslation();
  const [map, setMap] = useState<SocialMap>(() => parseSocialLinks(socialLinks));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const count = Object.keys(map).length;

  const save = async () => {
    if (count === 0) return setError(t('onb.errChannels'));
    setSaving(true);
    setError('');
    try {
      await api.post('/creators/profile', { social_links: serializeSocialLinks(map) });
      toast.success(t('social.platformsSaved'));
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : msg || t('onb.errGeneric'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="!max-w-2xl" data-testid="add-platforms">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <span className="v-hero-icon" style={{ width: 30, height: 30, borderRadius: 9 }}>
                  <Share2 size={13} />
                </span>
                {t('social.addPlatformsTitle')}
              </Modal.Heading>
              <p className="v-body v-muted mt-1" style={{ fontSize: 13.5 }}>{t('onb.platformsSub')}</p>
            </Modal.Header>
            <Modal.Body>
              <PlatformPicker value={parseSocialLinks(socialLinks)} onChange={setMap} testIdPrefix="addp" />
              {error && (
                <p className="v-caption mt-3" style={{ fontSize: 12.5, color: '#b3261e' }} role="alert">
                  {error}
                </p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose} isDisabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button variant="primary" onPress={save} isPending={saving} data-testid="add-platforms-save">
                <Check size={13} /> {t('social.savePlatforms', { n: count })}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

export default AddPlatformsModal;
