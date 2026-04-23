export default function EmptyState({ icon = '✨', title, description, action }) {
  return (
    <div className="text-center py-12 px-6">
      <div className="text-5xl mb-3">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
