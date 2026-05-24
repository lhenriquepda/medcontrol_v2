// MEL-006 v0.2.6.11 — auto-dismiss onboarding/tour.
import { inWebView } from './webview.mjs'

/**
 * Detecta OnboardingTour aberto + clica Skip/Próximo até fechar.
 * No-op se tour não estiver aberto.
 */
export async function dismissTour(driver, maxClicks = 8) {
  return inWebView(driver, async () => {
    for (let i = 0; i < maxClicks; i++) {
      const skip = await driver.$('button*=Pular')
      const exists = await skip.isExisting().catch(() => false)
      if (!exists) {
        const next = await driver.$('button*=Próximo')
        const nextExists = await next.isExisting().catch(() => false)
        if (!nextExists) return  // tour fechado
        await next.click()
      } else {
        await skip.click()
        return
      }
      await driver.pause(300)
    }
  })
}

/**
 * Aceita PermissionsOnboarding modal se aparecer (push + telemetria opt-in).
 * Ver context/recipes/consent-banner-decision.md sobre placement.
 */
export async function acceptPermissions(driver) {
  return inWebView(driver, async () => {
    const continueBtn = await driver.$('button*=Continuar')
    const exists = await continueBtn.isExisting().catch(() => false)
    if (exists) {
      await continueBtn.click()
      await driver.pause(500)
    }
  })
}
