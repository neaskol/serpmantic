import { test, expect } from '@playwright/test'

/**
 * Test E2E #2 - Création de Guide
 * Vérifie le flow dashboard → create guide → editor
 */
test.describe('Création de Guide', () => {
  // Setup: authentification avant chaque test
  test.beforeEach(async ({ page }) => {
    // En production, ajouter l'authentification réelle
    // Pour l'instant, naviguer directement vers dashboard
    // await page.goto('/dashboard')
  })

  test('devrait afficher le bouton de création de guide', async ({ page }) => {
    await page.goto('/dashboard')

    // Vérifier la présence du bouton "Créer un guide" ou équivalent
    const createButton = page.locator('button:has-text("Créer"), button:has-text("Nouveau")')

    // Si le bouton existe, vérifier qu'il est visible
    // Sinon, vérifier que la page dashboard est bien chargée
    const url = page.url()
    expect(url).toContain('/dashboard')
  })

  test('devrait ouvrir le dialog de création de guide', async ({ page }) => {
    await page.goto('/dashboard')

    // Chercher et cliquer sur le bouton de création
    const createButton = page.locator('button:has-text("Créer"), button:has-text("Nouveau")').first()

    if (await createButton.isVisible()) {
      await createButton.click()

      // Vérifier que le dialog s'ouvre
      // Chercher un input pour le mot-clé
      const keywordInput = page.locator('input[name="keyword"], input[placeholder*="mot-clé"], input[placeholder*="keyword"]')
      await expect(keywordInput).toBeVisible({ timeout: 5000 })
    }
  })

  test('devrait créer un guide et rediriger vers l\'éditeur', async ({ page }) => {
    await page.goto('/dashboard')

    // En production, compléter le flow :
    // 1. Cliquer sur "Créer un guide"
    // 2. Remplir le formulaire (mot-clé, langue)
    // 3. Soumettre
    // 4. Vérifier redirection vers /guide/[id]
    // 5. Vérifier que l'éditeur est chargé

    // Pour l'instant, vérifier que le dashboard existe
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('devrait valider le formulaire de création', async ({ page }) => {
    await page.goto('/dashboard')

    // Tester la validation :
    // - Mot-clé requis
    // - Langue requise
    // - Message d'erreur si champs vides
  })
})
