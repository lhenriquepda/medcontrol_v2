import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import { Sheet, Button } from './dosy'

/**
 * CropModal — pick region of image, output square photo_url.
 *
 * Item #114 (release v0.2.0.2) BUG-038: avatar foto sem crop UI.
 * Antes: PatientForm onPhoto fazia center-square crop automático sem
 * deixar user escolher região. Foto retangular com sujeito off-center
 * cortava errado. Agora: react-easy-crop modal com zoom slider + drag
 * pan, preview circular live. Confirm gera canvas 512×512 jpeg q0.78
 * (~50KB) salvo em photo_url. Lista nunca carrega photo_url — usa
 * photo_version + cache localStorage (Item #115).
 */

const TARGET_FULL = 512

async function cropToCanvas(srcDataUrl, area, target) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = srcDataUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = target
  canvas.height = target
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, target, target)
  return canvas
}

export default function CropModal({ open, src, onConfirm, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPx, setAreaPx] = useState(null)
  const [busy, setBusy] = useState(false)

  const onComplete = useCallback((_area, areaPixels) => {
    setAreaPx(areaPixels)
  }, [])

  async function confirm() {
    if (!areaPx) return
    setBusy(true)
    try {
      const fullCanvas = await cropToCanvas(src, areaPx, TARGET_FULL)
      const full = fullCanvas.toDataURL('image/jpeg', 0.78)
      onConfirm({ full })
    } finally {
      setBusy(false)
    }
  }

  function cancel() {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setAreaPx(null)
    onCancel()
  }

  return (
    <Sheet open={open} onClose={cancel} title="Ajustar foto" maxHeightVh={92}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          background: 'var(--dosy-bg-sunken)',
          borderRadius: 16,
          overflow: 'hidden',
        }}>
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onComplete}
              style={{
                containerStyle: { background: 'var(--dosy-bg-sunken)' },
              }}
            />
          )}
        </div>

        <div>
          <label style={{
            display: 'block',
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--dosy-fg-secondary)',
            margin: '0 0 8px 4px',
            fontFamily: 'var(--dosy-font-display)',
          }}>Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--dosy-primary)' }}
          />
        </div>

        <p style={{
          fontSize: 12, color: 'var(--dosy-fg-secondary)',
          margin: 0, textAlign: 'center',
          fontFamily: 'var(--dosy-font-body)',
        }}>
          Arraste a foto pra ajustar a região visível.
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Button kind="ghost" full onClick={cancel} disabled={busy}>Cancelar</Button>
          <Button kind="primary" full onClick={confirm} disabled={busy || !areaPx}>
            {busy ? 'Processando…' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
