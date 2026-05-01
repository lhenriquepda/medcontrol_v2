import { useEffect, useRef } from 'react'
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
  const prevPathRef = useRef(location.pathname)
  const directionRef = useRef('forward')

  // Atualiza direction a cada navegação
  useEffect(() => {
    const prev = prevPathRef.current
    const curr = location.pathname
    // Heurística: rota com menos segmentos = back
    const prevDepth = prev.split('/').filter(Boolean).length
    const currDepth = curr.split('/').filter(Boolean).length
    directionRef.current = currDepth < prevDepth ? 'back' : 'forward'
    prevPathRef.current = curr
  }, [location.pathname])

  if (shouldReduceMotion()) {
    return children
  }

  return (
    <div className="relative w-full" style={{ minHeight: '100vh' }}>
      <AnimatePresence mode="popLayout" custom={directionRef.current} initial={false}>
        <motion.div
          key={location.pathname}
          custom={directionRef.current}
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
