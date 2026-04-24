export default function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1">{label}</span>
      {children}
    </label>
  )
}
