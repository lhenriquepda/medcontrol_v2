import Icon from './Icon'

export default function EmptyState({ icon = 'sparkles', title, description, action }) {
  // icon: string semantic name (lucide via Icon) OR ReactNode
  const renderIcon = typeof icon === 'string'
    ? <Icon name={icon} size={48} className="text-slate-400 mx-auto" />
    : icon
  return (
    <div className="text-center py-12 px-6">
      <div className="mb-3 flex justify-center text-5xl">{renderIcon}</div>
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
