import { Modal, Button } from './dosy'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger,
  onConfirm,
  onClose,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p style={{
        fontSize: 14, color: 'var(--dosy-fg-secondary)',
        lineHeight: 1.5, margin: '0 0 18px 0',
      }}>{message}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button kind="secondary" onClick={onClose} full>
          {cancelLabel}
        </Button>
        <Button
          kind={danger ? 'danger-solid' : 'primary'}
          onClick={() => { onConfirm?.(); onClose?.() }}
          full
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
