import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { pageTransition, shouldReduceMotion } from '../animations'

/**
 * AnimatedRoutes — wrapper pra <Routes> com slide lateral.
 *
 * Uso:
 *   <AnimatedRoutes>
 *     <Routes>
 *       <Route path="/" element={<Home />} />
 *       ...
 *     </Routes>
 *   </AnimatedRoutes>
 *
 * Requer container `position: relative` em parent (main).
 *
 * Direção:
 *   - forward: navegar pra rota mais "profunda" (default)
 *   - back: detectado via popstate ou ao subir niveis (fallback heurística)
 */
export default function AnimatedRoutes({ children }) {
  const location = useLocation()
  // Item #127: state em vez de ref pra evitar leitura ref durante render (react-hooks/refs).
  // prevPath retém pathname anterior; direction é derivado puro durante render.
  const [prevPath, setPrevPath] = useState(location.pathname)

  const prevDepth = prevPath.split('/').filter(Boolean).length
  const currDepth = location.pathname.split('/').filter(Boolean).length
  const direction = currDepth < prevDepth ? 'back' : 'forward'

  useEffect(() => {
    if (prevPath !== location.pathname) setPrevPath(location.pathname)
  }, [location.pathname, prevPath])

  if (shouldReduceMotion()) {
    return children
  }

  return (
    <div className="relative w-full" style={{ minHeight: '100vh' }}>
      <AnimatePresence mode="popLayout" custom={direction} initial={false}>
        <motion.div
          key={location.pathname}
          custom={direction}
          variants={pageTransition.variants}
          {...pageTransition.motionProps}
          style={{ width: '100%' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
