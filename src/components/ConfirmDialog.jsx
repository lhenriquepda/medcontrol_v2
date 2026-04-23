import BottomSheet from './BottomSheet'

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger, onConfirm, onClose }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{message}</p>
      <div className="flex gap-2">
        <button className="btn-secondary flex-1" onClick={onClose}>{cancelLabel}</button>
        <button className={danger ? 'btn-danger flex-1' : 'btn-primary flex-1'} onClick={() => { onConfirm?.(); onClose?.() }}>
          {confirmLabel}
        </button>
      </div>
    </BottomSheet>
  )
}
