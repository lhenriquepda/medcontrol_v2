import { createContext, useContext, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

const ThemeCtx = createContext(null)
const KEY = 'medcontrol_theme'

const STATUSBAR_BG_LIGHT = '#FFF4EC'
const STATUSBAR_BG_DARK = '#1A0F0A'

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(KEY)
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(KEY, theme)
    if (!Capacitor.isNativePlatform()) return
    ;(async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar')
        const bg = theme === 'dark' ? STATUSBAR_BG_DARK : STATUSBAR_BG_LIGHT
        const style = theme === 'dark' ? Style.Dark : Style.Light
        await StatusBar.setBackgroundColor({ color: bg })
        await StatusBar.setStyle({ style })
      } catch {}
    })()
  }, [theme])
  return (
    <ThemeCtx.Provider value={{ theme, setTheme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export const useTheme = () => useContext(ThemeCtx)
