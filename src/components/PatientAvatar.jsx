import { Avatar } from './dosy'
import { usePatientPhoto } from '../hooks/usePatientPhoto'

/**
 * PatientAvatar — renders patient photo if cached, fallback emoji.
 *
 * Item #115 (release v0.2.0.2): wrapper que combina Avatar dosy primitivo
 * com lazy-loaded photo via usePatientPhoto hook. Lista nunca paga
 * download de photo_url — só paga se cache local miss (1ª visita per
 * device OU foto editada).
 *
 * Props:
 *   - patient: { id, avatar, photo_version }
 *   - size: pixels (default 44)
 *   - color: Avatar palette (default 'peach')
 */
export default function PatientAvatar({ patient, size = 44, color = 'peach', style }) {
  const photo = usePatientPhoto(patient?.id, patient?.photo_version)
  if (photo) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 9999,
        overflow: 'hidden', flexShrink: 0,
        background: 'var(--dosy-peach-100)',
        ...style,
      }}>
        <img
          src={photo}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    )
  }
  return <Avatar emoji={patient?.avatar || '👤'} color={color} size={size} style={style}/>
}
