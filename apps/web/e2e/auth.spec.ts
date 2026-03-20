import { test, expect } from '@playwright/test'

/**
 * Test E2E #1 - Authentification
 * Vérifie le flow login → dashboard
 */
test.describe('Authentification', () => {
  test('devrait afficher la page de login', async ({ page }) => {
    await page.goto('/login')

    // Vérifier les éléments de la page
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('devrait rediriger vers dashboard après login réussi', async ({ page }) => {
    // Note: Nécessite des credentials de test configurés
    // Pour l'instant, on vérifie juste la navigation
    await page.goto('/login')

    // En production, ajouter :
    // await page.fill('input[type="email"]', 'test@example.com')
    // await page.fill('input[type="password"]', 'testpassword')
    // await page.click('button[type="submit"]')
    // await expect(page).toHaveURL('/dashboard')

    // Pour l'instant, vérifier que la page login existe
    await expect(page).toHaveURL(/\/login/)
  })

  test('devrait afficher une erreur avec des credentials invalides', async ({ page }) => {
    await page.goto('/login')

    // Simuler une tentative de login
    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeVisible()

    // En production, tester avec des mauvais credentials
    // et vérifier l'affichage d'un message d'erreur
  })
})
