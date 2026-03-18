# Design: Amélioration UI/UX globale avec shadcn/ui

**Date**: 2026-03-18
**Approche retenue**: A — Composants manquants essentiels
**Thème**: Conserver le style base-nova existant

---

## Objectif

Ajouter 8 composants shadcn/ui manquants pour résoudre des lacunes UX concrètes : absence de notifications, loading states manquants, formulaires incohérents, navigation pauvre, et manque d'actions contextuelles.

## Composants à installer

| Composant | Commande |
|-----------|----------|
| Sonner | `npx shadcn@latest add sonner` |
| Select | `npx shadcn@latest add select` |
| AlertDialog | `npx shadcn@latest add alert-dialog` |
| Skeleton | `npx shadcn@latest add skeleton` |
| DropdownMenu | `npx shadcn@latest add dropdown-menu` |
| Breadcrumb | `npx shadcn@latest add breadcrumb` |
| Table | `npx shadcn@latest add table` |
| Popover | `npx shadcn@latest add popover` |

---

## Section 1 — Notifications (Sonner)

**Problème**: Aucun feedback visuel sur save, analyse, ou erreurs.

**Solution**: Installer sonner, ajouter `<Toaster />` dans le root layout.

Intégrations:
- Save auto → toast "Guide sauvegardé" (success, 2s)
- Analyse SERP lancée → toast.promise "Analyse en cours..."
- Analyse terminée → toast "Analyse terminée — Score: X/120"
- Erreurs → toast.error avec message contextuel
- Placement: bottom-right, empilable

**Fichiers**:
- `apps/web/src/app/layout.tsx` — `<Toaster />`
- `apps/web/src/app/(editor)/guide/[id]/page.tsx` — toast sur save/analyse
- `apps/web/src/app/(dashboard)/dashboard/page.tsx` — toast sur création/suppression

## Section 2 — Formulaires (Select + AlertDialog)

**Problème**: `<select>` HTML natif incohérent. Aucune confirmation avant actions destructives.

**Solution**:
- Select shadcn pour langue et moteur de recherche dans create-guide-dialog
- AlertDialog pour confirmation de suppression de guide

**Fichiers**:
- `apps/web/src/components/dashboard/create-guide-dialog.tsx` — Select
- `apps/web/src/components/dashboard/guide-card.tsx` — AlertDialog suppression

## Section 3 — Loading States (Skeleton)

**Problème**: Flash de contenu ou écran vide pendant le chargement.

**Solution**:
- Dashboard: skeleton grid (3 cards fantômes)
- Score display: skeleton circle + bar
- Structural metrics: skeleton rows
- Semantic terms list: skeleton list items

**Fichiers**:
- `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- `apps/web/src/components/analysis/score-display.tsx`
- `apps/web/src/components/analysis/structural-metrics.tsx`
- `apps/web/src/components/analysis/semantic-terms-list.tsx`

## Section 4 — Actions contextuelles (DropdownMenu)

**Problème**: Guide cards sans actions (pas de supprimer, dupliquer).

**Solution**: DropdownMenu (icône "..." top-right) avec:
- Ouvrir
- Dupliquer
- Partager (désactivé)
- Séparateur
- Supprimer (rouge, déclenche AlertDialog)

**Fichiers**:
- `apps/web/src/components/dashboard/guide-card.tsx`

## Section 5 — Navigation (Breadcrumb)

**Problème**: Seul un bouton "Retour" dans l'éditeur.

**Solution**: Breadcrumb: `Dashboard > Mes guides > "keyword"`

**Fichiers**:
- `apps/web/src/app/(editor)/guide/[id]/page.tsx`

## Section 6 — Données SERP (Table)

**Problème**: Benchmark SERP = liste de cards avec badges, pas de tri.

**Solution**: Table shadcn avec colonnes: #, Page, Score, Mots, Titres, Liens, Images. Triable par score/mots.

**Fichiers**:
- `apps/web/src/components/analysis/serp-benchmark.tsx`

## Section 7 — Recherche de termes (Popover + Input)

**Problème**: Pas de recherche textuelle dans la liste de termes sémantiques.

**Solution**: Input de recherche + Popover pour options de tri (importance, delta, alphabétique).

**Fichiers**:
- `apps/web/src/components/analysis/semantic-terms-list.tsx`

## Section 8 — Toolbar color picker (Popover)

**Problème**: `<input type="color">` natif incohérent.

**Solution**: Popover avec grille de couleurs prédéfinies + option "Personnalisé".

**Fichiers**:
- `apps/web/src/components/editor/toolbar.tsx`

---

## Contraintes

- Ne pas casser le state management Zustand existant
- Conserver le thème base-nova et les couleurs OKLCH
- Conserver la structure de fichiers actuelle
- Tous les composants dans `components/ui/`
- Pas de nouvelles dépendances hors shadcn
