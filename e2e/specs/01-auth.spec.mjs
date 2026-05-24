// MEL-006 v0.2.6.11 — spec 01 auth smoke.
// Cobre cenário Módulo 01 do roteiro QA exaustivo.
// Cobertura adicional (signup, OTP, AppLock) será portada incrementalmente.
import { expect } from 'chai'
import { loginAs, isLoggedIn } from '../helpers/auth.mjs'
import { dismissTour, acceptPermissions } from '../helpers/dismissTour.mjs'
import { inWebView } from '../helpers/webview.mjs'

describe('Mod 01 — Auth + Onboarding (smoke)', function () {
  this.timeout(120_000)

  it('01.1 — login email/senha teste-plus + dashboard render', async function () {
    await loginAs(driver, 'teste-plus@teste.com', '123456')

    const logged = await isLoggedIn(driver)
    expect(logged, 'session Supabase deve existir após login').to.equal(true)

    await dismissTour(driver)
    await acceptPermissions(driver)

    // Dashboard deve mostrar HeroGauge (smoke: presença de número adesão)
    await inWebView(driver, async () => {
      const gauge = await driver.$('[data-testid="hero-gauge"], .dosy-hero-gauge, h1')
      const exists = await gauge.isExisting().catch(() => false)
      expect(exists, 'Dashboard deve renderizar elemento principal').to.equal(true)
    })
  })
})
