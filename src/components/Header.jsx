import { useNavigate } from 'react-router-dom'

export default function Header({ title, back, right, subtitle }) {
  const nav = useNavigate()
  return (
    <header className="bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-100 dark:border-slate-800">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-2">
        {back ? (
          <button onClick={() => nav(-1)} className="w-9 h-9 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center">
            <span className="text-xl">‹</span>
          </button>
        ) : null}
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  )
}
