/**
 * Declarative confirm dialog. Kept for the screens that already drive it with
 * their own open / onConfirm state; visually it is the shared SweetAlert card,
 * so it looks identical to `swal.confirm()` / `swal.danger()`.
 *
 * New code should prefer the imperative API:
 *   if (await swal.danger({ title, text })) { … }
 */
import type { ReactNode } from 'react';
import { SweetAlertCard, type SweetAlertType } from './SweetAlert';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: ReactNode;
  message: ReactNode;
  confirmText?: ReactNode;
  cancelText?: ReactNode;
  type?: 'danger' | 'warning' | 'info' | 'question' | 'success';
  /** Show a spinner on the confirm button and lock the dialog. */
  isLoading?: boolean;
  /** Custom icon inside the ring (defaults to the animated one for `type`). */
  icon?: ReactNode;
  children?: ReactNode;
}

const TYPE_MAP: Record<NonNullable<ConfirmationModalProps['type']>, SweetAlertType> = {
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  question: 'question',
  success: 'success',
};

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  type = 'warning',
  isLoading,
  icon,
  children,
}: ConfirmationModalProps) {
  return (
    <SweetAlertCard
      open={isOpen}
      type={TYPE_MAP[type]}
      title={title}
      text={message}
      icon={icon}
      confirmText={confirmText}
      cancelText={cancelText}
      loading={isLoading}
      showClose
      onCancel={onClose}
      onConfirm={async () => {
        await onConfirm();
        // A controlled `isLoading` caller closes the dialog itself once its
        // request settles; otherwise close right after the handler.
        if (!isLoading) onClose();
      }}
    >
      {children}
    </SweetAlertCard>
  );
}
