import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Modal } from '@heroui/react';
import { useTranslation } from 'react-i18next';

/**
 * ConfirmModal — the app's answer to window.confirm.
 *
 * One dialog for every "are you sure" moment: destructive actions get the
 * coral tone and a danger button, everything else the primary button.
 * Controlled by `open`; the caller owns the pending state so the button
 * shows a spinner while the request is in flight.
 */
export const ConfirmModal: React.FC<{
  open: boolean;
  title: React.ReactNode;
  body?: React.ReactNode;
  confirmLabel: React.ReactNode;
  cancelLabel?: React.ReactNode;
  tone?: 'danger' | 'primary';
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ open, title, body, confirmLabel, cancelLabel, tone = 'primary', pending = false, onConfirm, onClose }) => {
  const { t } = useTranslation();
  return (
    <Modal isOpen={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <Modal.Backdrop isDismissable={!pending}>
        <Modal.Container>
          <Modal.Dialog className="!max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="inline-flex items-center gap-2">
                {tone === 'danger' && <AlertTriangle size={16} style={{ color: '#ff5a5f' }} />}
                {title}
              </Modal.Heading>
            </Modal.Header>
            {body && (
              <Modal.Body>
                <div className="v-body v-muted" style={{ fontSize: 13.5 }}>{body}</div>
              </Modal.Body>
            )}
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose} isDisabled={pending}>
                {cancelLabel ?? t('common.cancel')}
              </Button>
              <Button variant={tone === 'danger' ? 'danger' : 'primary'} onPress={onConfirm} isPending={pending}>
                {confirmLabel}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

export default ConfirmModal;
