# CLAUDE.md — SERPmantics : Audit Produit Complet

## Contexte du projet

Tu vas m'aider à construire une application similaire à **SERPmantics** (app.serpmantics.com), un outil SaaS de rédaction et d'optimisation sémantique SEO. Ce document est le référentiel complet de compréhension produit issu de l'audit de l'application existante.

---

## 1. DESCRIPTION GÉNÉRALE DU PRODUIT

SERPmantics est un **outil SaaS de SEO sémantique** basé sur l'analyse comparative de la SERP Google (les ~10 premières pages de résultats). Son principe central : analyser le champ lexical, la fréquence des termes et la structure des contenus qui rankent déjà pour une requête cible, puis guider l'utilisateur pour que son propre contenu soit au moins aussi pertinent sémantiquement.

- **Cible** : rédacteurs web, consultants SEO, équipes content marketing
- **Positionnement** : concurrent de Surfer SEO, NeuronWriter, Frase, MarketMuse, Yourtextguru
- **Stack UI** : interface divisée en deux zones — éditeur WYSIWYG à gauche, panneau d'analyse à droite

---

## 2. ARCHITECTURE INTERFACE UTILISATEUR

### Zone gauche — Éditeur WYSIWYG
- Éditeur de texte enrichi (type TipTap/ProseMirror) avec toolbar flottante
- Fonctionnalités : Undo/Redo, niveaux de titres H1-H6, gras, italique, souligné, couleur de texte, alignement
- Blocs supportés : paragraphes, titres, listes (ul/ol), tableaux, images, vidéos, liens
- Analyse du contenu en **temps réel** à chaque modification
- Le texte sélectionné peut être transmis aux prompts IA pour modification locale

### Zone droite — Panneau d'analyse (7 onglets)

| Onglet | Emoji | Rôle |
|--------|-------|------|
| IAssistant | 🤖 | Assistant IA avec bibliothèque de prompts multi-LLM |
| Plan | 📑 | Génération IA du plan de contenu optimal |
| Intention | 🎯 | Analyse de l'intention de recherche |
| Optimisation | 🔍 | Scoring sémantique temps réel (cœur du produit) |
| Liens | 🔗 | Recommandations de maillage interne |
| Meta | 🧐 | Titre SEO + meta description |
| Config | 🔧 | Configuration du guide et partage |

---

## 3. MODULE OPTIMISATION (cœur du produit)

### 3.1 Score global sémantique

- Score numérique de **0 à 120** (plafonné volontairement à 120)
- Comparaison du contenu utilisateur avec les pages de la 1ère page Google
- Échelle de couleurs : rouge → orange → jaune → vert → bleu
- Le score 100 = moyenne des meilleurs résultats Google
- **Au-delà de 100 = sur-optimisation** : l'outil avertit de ne pas dépasser
- Exemple observé : score 93 = 'meilleur que 75% des pages de la 1ère page de Google'
- Label qualitatif associé : Mauvais / Moyen / Bon / Excellent

### 3.2 Indicateurs structurels avec benchmarks SERP

8 métriques analysées et comparées à la fourchette observée sur la SERP :

| Métrique | Exemple fourchette SERP | Statuts possibles |
|----------|------------------------|-------------------|
| # mots | 1096-2202 | OK / manque / trop |
| # titres | 12-23 | OK / manque / trop |
| # paragraphes | 18-62 | OK / manque / trop |
| # liens | 12-50 | OK / manque / trop |
| # images | 4-9 | OK / manque / trop |
| # vidéos | 0-1 | OK / manque / trop |
| # tableaux | 0-1 | OK / manque / trop |
| # listes | 6-13 | OK / manque / trop |

Chaque indicateur affiche un message contextuel (ex: 'Il n'y a pas assez de liens. Essayez d'en ajouter au moins 12.')

### 3.3 Recommandation de mise à jour

- Calcule une fréquence de rafraîchissement recommandée (ex: 'tous les 7 mois')
- Affiche la date approximative de prochain update (ex: '18/10/2026')
- Mécanisme : analyse de la fréquence de mise à jour des concurrents SERP

### 3.4 Liste des expressions sémantiques (moteur NLP)

Fonctionnalité centrale. Pour chaque terme/expression identifié sur la SERP :

**Données affichées :**
- Le terme (lemmatisé, sans accent, en minuscule)
- La fourchette optimale d'occurrences (min-max)
- Le nombre actuel d'occurrences dans le contenu utilisateur
- Signal : OK (dans la fourchette) / manque / trop
- Encadré noir = terme identifié comme mot-clé principal de la requête

**Types de termes :**
- Unigrammes : 'cee', 'energie', 'delegation'
- Bigrammes : 'economies d energie', 'delegataire cee', 'renovation energetique'
- Trigrammes : 'certificats d economies d energie', 'pole national des certificats'
- Expressions longue traîne : 'ministere de la transition ecologique', 'devenir delegataire cee'

**Messages d'état :**
- Bien joue : 'Vous avez le bon nombre d occurrences pour ce terme.'
- Manque : 'Essayez d ajouter encore au moins N occurrence(s).'
- Trop : 'Essayez de retirer au moins N occurrence(s).'

**Pipeline NLP :**
1. Crawl des pages SERP top-10 pour la requête
2. Extraction et nettoyage du texte (suppression HTML, balises, navigation)
3. Tokenisation + lemmatisation + normalisation (lowercase, suppression accents)
4. Extraction TF-IDF ou cooccurrence des termes significatifs
5. Calcul des percentiles (P10-P90) pour les fourchettes d'occurrences
6. Construction du dictionnaire sémantique de référence
7. Scoring en temps réel par comparaison avec le contenu utilisateur

### 3.5 Filtres de la liste d'expressions

- **Voir toutes les expressions** : liste complète
- **A ajouter** : uniquement les termes manquants
- **A supprimer** : uniquement les termes en excès

Fonctions supplémentaires :
- Bouton 'Surligner ces expressions dans le contenu' : highlight visuel dans l'éditeur
- Bouton 'Voir la heatmap' : visualisation colorimétrique de densité sémantique par zone du texte
- Bouton 'Visualiser / Répartition de la sémantique' : vue d'ensemble de la distribution dans le document
- Bouton 'Optimiser automatiquement mon contenu' (Beta) : réécriture IA automatique pour atteindre les fourchettes cibles

### 3.6 Section 'Expressions à éviter'

- Termes présents chez des concurrents mais non corrélés avec le ranking (termes parasites)
- Exemples observés : 'secteurs', 'partenaires', 'expert', 'offres', 'cookies', 'transport', 'coup de pouce'
- Ces termes révèlent des contenus trop commerciaux, de navigation, ou hors-sujet
- Statuts : 'Ce terme est présent N fois. Supprimez ses occurrences.' / 'Ce terme n est pas présent. C est bien !'

### 3.7 Benchmark des résultats SERP

Pour chaque page de la SERP utilisée comme référence :
- URL complète + titre de la page
- Score SERPmantics calculé (0-120)
- Métriques structurelles : mots, titres, paragraphes, liens, images, vidéos, tableaux, listes
- Bouton 'voir plus +' pour le détail des expressions sémantiques de cette page
- Certaines pages marquées 'Résultat non pris en compte' (exclues du calcul)

Exemple observé pour la requête 'delegataire cee' :
- opera-energie.com → Score 100 (référence max), 2202 mots
- gc2e.fr → Score 90, 1549 mots
- solutions.acciona-energia.fr → Score 75, 966 mots
- hellio.com → Score 25, 897 mots

---

## 4. MODULE IASSISTANT (IA intégrée)

### 4.1 Architecture multi-LLM

L'outil utilise deux fournisseurs LLM en parallèle avec sélection par cas d'usage :

| Fournisseur | Modèles observés | Cas d'usage typiques |
|-------------|------------------|---------------------|
| Anthropic | Claude Sonnet 4, Claude Sonnet 4.5 | Construction plan, introduction |
| OpenAI | GPT-5 Chat, GPT-5 Mini | Suppression passages, fautes, sémantique, médias |

### 4.2 Prompts publics (15 disponibles)

Exemples observés :
- **Construction plan Hn** — Claude Sonnet 4.5 — génère le plan H2/H3 optimal
- **Supprimer les passages sans gain d'informations** — GPT-5 Chat
- **Mettre en évidence les fautes d'orthographe et de grammaire** — GPT-5 Chat
- **Réécrire avec un ton naturel & humain** — GPT-5 Mini
- **Optimiser la sémantique du passage sélectionné** — GPT-5 Mini
- **Ecrire une bonne introduction** — Claude Sonnet 4
- **Suggérer des ajouts de médias pertinents (images, vidéos, tableaux, outils)** — GPT-5 Chat

### 4.3 Système de contextes

- Les prompts sont enrichis avec des 'contextes' configurables (audience, ton, secteur, brief)
- Message si vide : 'Aucun contexte disponible — Créez-en un pour personnaliser les prompts'
- Actions : 'Ajouter un prompt', 'Gérer mes prompts', 'Gérer mes contextes'
- Section 'Afficher les valeurs des variables pour ce guide'

### 4.4 Mode d'exécution des prompts

- Bouton 'Exécuter' sur chaque prompt
- Application sur texte sélectionné dans l'éditeur OU sur le document entier
- Résultat injecté directement dans l'éditeur (remplacement ou insertion)
- Interface de résultat inline dans le panneau

### 4.5 Prompts utilisateurs

- L'utilisateur peut créer et sauvegarder ses propres prompts personnalisés
- Système de tags (public / utilisation publique)

---

## 5. MODULE PLAN

- Bouton principal : 'Générer le plan optimal' (action IA)
- IMPORTANT : l'exécution remplace le contenu actuel de l'éditeur — nécessite que l'éditeur soit vide
- Section 'Aide à la construction du plan' avec vidéo tutorielle intégrée
- Mécanisme : analyse des H2/H3 des pages SERP, regroupement thématique, génération d'un plan couvrant les sous-thèmes les plus représentés

---

## 6. MODULE INTENTION

- Analyse l'intention de recherche derrière le mot-clé cible
- Deux actions :
  - 'Identifier les intentions' : analyse IA de la SERP (types de pages, questions récurrentes)
  - 'Analyser mon contenu' : vérifie si le contenu répond aux intentions identifiées
- Mécanisme : classification informationnel / transactionnel / navigationnel / comparatif

---

## 7. MODULE LIENS (Maillage interne)

- Suggestion de maillage interne (liens entrants et sortants)
- Prérequis : lier une URL à ce guide ET assigner un groupe de guides (autres pages du site)
- Sans configuration : message d'avertissement avec instructions
- Mécanisme : analyse sémantique cross-pages pour identifier les opportunités de liens contextuels

---

## 8. MODULE META

- Champ 'Titre de la page' : compteur 0/60 caractères, bouton copie
- Champ 'Meta description' : compteur 0/158 caractères, bouton copie
- Bouton 'Enregistrer' : sauvegarde les metas liées au guide
- Bouton 'Suggérer des idées' : génération IA de meta title/description optimisés
- Vidéo tutorielle intégrée

---

## 9. MODULE CONFIG

### 9.1 Modes de partage
- Privé : accès uniquement au propriétaire
- Partagé (Lecture) : accès en lecture seule via lien
- Partagé (Edition) : accès en écriture via lien

### 9.2 Connexion URL (en développement)
- Liaison de la page publiée au guide
- Champ URL + bouton 'Lier la page'
- Fonctionnalités à venir : surveillance du contenu publié vs guide

### 9.3 Menu hamburger (options globales)
- 'Forcer l analyse du contenu' : relance un crawl SERP et recalcul complet
- Sélecteur de langue avec changement d'URL
- 'Retour à la liste des guides'

### 9.4 Support multilingue
5 langues supportées avec routing par URL :
- Français : /fr/ (défaut)
- English : /en/
- Italiano : /it/
- Deutsch : /de/
- Español : /es/

---

## 10. MÉCANISMES TECHNIQUES DÉTAILLÉS

### 10.1 Pipeline d'analyse SERP (backend — implémenté)

1. Réception mot-clé + locale (langue, pays) via `/api/serp/analyze`
2. Requête SerpAPI (Google Search) — `apps/web/src/lib/serp.ts`
3. Récupération des ~10 premières URLs de la SERP
4. Filtrage des URLs non pertinentes (réseaux sociaux, Wikipedia, etc.) — filtrage par domaine
5. Crawl HTTP de chaque page via Cheerio — `apps/web/src/lib/crawler.ts`
6. Parsing et nettoyage : suppression navigation, footer, publicités, scripts
7. Extraction du texte éditorial + calcul des métriques structurelles
8. Envoi au service NLP Python (TextRazor v2.0) — `services/nlp/textrazor_pipeline.py`
9. NLP : tokenisation → lemmatisation → normalisation (lowercase, suppression accents) via TextRazor API
10. Extraction TF-IDF + n-grams (unigrammes, bigrammes, trigrammes)
11. Calcul des percentiles (P10-P90) pour les fourchettes d'occurrences
12. Construction du référentiel sémantique stocké en Supabase (tables `serp_analyses`, `serp_pages`, `semantic_terms`)
13. Calcul du score sémantique de chaque page SERP (score 0-120) — `apps/web/src/lib/scoring.ts`
14. Cache NLP par URL (Supabase, TTL 7 jours) — `apps/web/src/lib/nlp-cache.ts`
15. Agrégation client-side des résultats NLP — `apps/web/src/lib/nlp-aggregator.ts`

### 10.2 Pipeline de scoring temps réel (frontend — implémenté)

1. Modification dans l'éditeur TipTap → déclenchement (debounce ~500ms)
2. Extraction du texte brut depuis le modèle de l'éditeur — `editor-store.ts`
3. Normalisation locale : lowercase, suppression accents — `apps/web/src/lib/text-utils.ts`
4. Comptage des occurrences pour chaque terme du référentiel SERP
5. Comparaison avec les fourchettes min-max du référentiel
6. Calcul du score global (somme pondérée des termes dans/hors fourchette) — `apps/web/src/lib/scoring.ts`
7. Mise à jour de l'UI : score, couleur, compteurs, alertes par terme — `guide-store.ts`

### 10.3 Calcul du score global (implémenté)

score = Somme pondérée ( poids_terme × f(occurrences_actuelles, min, max) )

Où f(x, min, max) :
- si x < min → score partiel proportionnel (x/min)
- si min ≤ x ≤ max → score plein (1.0)
- si x > max → pénalité (score réduit)

Score normalisé sur une échelle 0-120.
Labels : Mauvais (0-30), Moyen (31-55), Bon (56-75), Excellent (76-100), Sur-optimisé (>100).
Seuil vert : ~75-100. Sur-optimisation : > 100 (pénalité affichée).

### 10.4 Architecture IA (IAssistant — implémenté)

1. Prompt utilisateur sélectionné — `apps/web/src/components/analysis/assistant-panel.tsx`
2. Enrichissement avec contexte guide (mot-clé, langue, données SERP) — `apps/web/src/lib/ai/context-builder.ts`
3. Enrichissement avec contexte utilisateur (audience, ton, secteur) — `prompt_contexts` table
4. Enrichissement avec contenu actuel ou sélection de l'éditeur
5. Routage vers LLM (Anthropic Claude ou OpenAI GPT selon le prompt) — `apps/web/src/lib/ai/router.ts`
6. Exécution via Vercel AI SDK — `apps/web/src/lib/ai/executor.ts`
7. Injection dans l'éditeur (remplacement ou insertion à la position du curseur)

---

## 11. MODÈLE DE DONNÉES (structures clés)

### Guide (entité principale)
```json
{
  "id": "string",
  "keyword": "string",
  "language": "fr|en|it|de|es",
  "searchEngine": "google.fr|google.com|...",
  "content": "rich-text-json",
  "metaTitle": "string (max 60 chars)",
  "metaDescription": "string (max 158 chars)",
  "linkedUrl": "string|null",
  "groupId": "string|null",
  "visibility": "private|read|edit",
  "shareToken": "string|null",
  "serpData": "SerpAnalysis object",
  "score": "number (0-120)",
  "createdAt": "datetime",
  "updatedAt": "datetime",
  "refreshRecommendedAt": "datetime"
}
```

### SerpAnalysis (référentiel sémantique)
```json
{
  "keyword": "string",
  "language": "string",
  "analyzedAt": "datetime",
  "pages": "[SerpPage]",
  "semanticTerms": "[SemanticTerm]",
  "structuralBenchmarks": {
    "words": { "min": "number", "max": "number" },
    "headings": { "min": "number", "max": "number" },
    "paragraphs": { "min": "number", "max": "number" },
    "links": { "min": "number", "max": "number" },
    "images": { "min": "number", "max": "number" },
    "videos": { "min": "number", "max": "number" },
    "tables": { "min": "number", "max": "number" },
    "lists": { "min": "number", "max": "number" }
  },
  "refreshIntervalMonths": "number",
  "termsToAvoid": "[string]"
}
```

### SemanticTerm
```json
{
  "term": "string (normalized: lowercase, no accent)",
  "displayTerm": "string (original)",
  "isMainKeyword": "boolean",
  "minOccurrences": "number",
  "maxOccurrences": "number",
  "importance": "number (weight for scoring)",
  "type": "unigram|bigram|trigram|phrase"
}
```

### SerpPage
```json
{
  "url": "string",
  "title": "string",
  "score": "number",
  "isExcluded": "boolean",
  "metrics": {
    "words": "number",
    "headings": "number",
    "paragraphs": "number",
    "links": "number",
    "images": "number",
    "videos": "number",
    "tables": "number",
    "lists": "number"
  },
  "termOccurrences": "{ term: count }"
}
```

### Prompt (IAssistant)
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "llmProvider": "anthropic|openai",
  "model": "claude-sonnet-4-5|gpt-4o|gpt-4o-mini",
  "promptTemplate": "string (with variables)",
  "scope": "selection|document|full",
  "isPublic": "boolean",
  "ownerId": "string|null",
  "category": "string"
}
```

---

## 12. ÉTAT D'AVANCEMENT DES FEATURES

### Priorité 1 — Cœur fonctionnel (MVP) — TERMINÉ
- [x] Crawler SERP + extraction NLP des pages (`serp.ts`, `crawler.ts`, `textrazor_pipeline.py`)
- [x] Construction du référentiel sémantique — termes + fourchettes (`semantic_terms` table, P10-P90)
- [x] Éditeur WYSIWYG TipTap (`tiptap-editor.tsx`, `toolbar.tsx`)
- [x] Scoring temps réel 0-120 avec mise à jour live (`scoring.ts`, `text-utils.ts`)
- [x] Liste des expressions avec statuts OK/manque/trop (`semantic-terms-list.tsx`)
- [x] Métriques structurelles avec benchmarks SERP (`structural-metrics.tsx`)
- [x] Section 'termes à éviter' (`avoid-terms-list.tsx`)
- [x] Benchmark des pages SERP avec scores (`serp-benchmark.tsx`)

### Priorité 2 — IA et plan — TERMINÉ (sauf auto-optimisation)
- [x] Module Plan — génération IA du plan H2/H3 (`plan-panel.tsx`, `/api/ai/plan`)
- [x] Module IAssistant — bibliothèque de 15 prompts multi-LLM (`assistant-panel.tsx`, `/api/ai/execute`)
- [x] Module Intention — analyse intention de recherche (`intention-panel.tsx`, `/api/ai/intention`)
- [x] Module Meta — titre + description avec génération IA (`meta-panel.tsx`, `/api/ai/meta`)
- [ ] Optimisation automatique Beta (réécriture IA pour atteindre les fourchettes)

### Priorité 3 — Collaboration et avancé — EN COURS
- [x] Système de partage (privé/lecture/édition) — champ `visibility` + `share_token` en DB
- [x] Config module — force re-analysis, language selector (`config-panel.tsx`)
- [~] Module Liens — UI existe (`links-panel.tsx`) mais algorithme de maillage NON implémenté
- [~] Contextes personnalisés — table `prompt_contexts` + sélecteur, mais CRUD complet manquant
- [ ] Connexion URL (surveillance de la page publiée) — champ DB existe, pas de logique
- [ ] Heatmap sémantique dans l'éditeur
- [ ] Recommandation de date de mise à jour — champ DB existe, pas de calcul
- [ ] Support multilingue routing (FR/EN/IT/DE/ES) — NLP multilingue OK, routing i18n NON
- [ ] Prompts utilisateurs custom — DB supportée, UI de création manquante

### Priorité 4 — Fonctionnalités avancées (opportunités) — NON COMMENCÉ
- [ ] Export PDF/Word du guide
- [ ] Historique des versions (snapshots du contenu)
- [ ] Collaboration temps réel (type Google Docs)
- [ ] Audit d'une URL publiée existante
- [ ] Tableau de bord multi-guides avec suivi du score dans le temps
- [ ] API publique pour intégration CMS (WordPress, Shopify)
- [ ] Mode comparaison avant/après optimisation

---

## 13. STACK TECHNIQUE (implémentée)

### Frontend
- **Framework** : Next.js 16.2.0 (App Router)
- **React** : 19.0.0
- **Editeur** : TipTap 3.20.4 (basé ProseMirror)
- **UI** : shadcn/ui style **base-nova** (`@base-ui/react`, PAS Radix UI) + Tailwind CSS v4
- **State** : Zustand 5.0.12 (4 stores : `guide-store`, `editor-store`, `ai-store`, `context-store`)
- **Variantes** : class-variance-authority (CVA)
- **Notifications** : Sonner (toasts)
- **Temps réel** : debounce 500ms sur les modifications éditeur

### Backend / API
- **API Routes** : Next.js Route Handlers (21 routes)
- **NLP** : Python FastAPI service (`services/nlp/`) avec **TextRazor API v2.0** (lemmatisation multilingue FR/EN/IT/DE/ES)
- **NLP Fallback** : Pipeline basique tokenisation (`pipeline.py`) pour mode offline
- **Crawler** : Cheerio (`apps/web/src/lib/crawler.ts`) pour parsing HTML
- **SERP** : SerpAPI (`apps/web/src/lib/serp.ts`) pour récupération des résultats Google
- **LLM** : Vercel AI SDK 6.0.132 + `@ai-sdk/anthropic` 3.0.62 + `@ai-sdk/openai` 3.0.46
  - Anthropic : Claude Sonnet 4.5 (plan), Claude Sonnet 4 (introduction, intention)
  - OpenAI : GPT-4o (grammaire, médias), GPT-4o-mini (rédaction, sémantique)
- **Rate Limiting** : Upstash Redis — 5 req/h par user pour analyse SERP

### Base de données
- **Principale** : Supabase PostgreSQL (9 migrations appliquées)
  - Tables : `profiles`, `guides`, `guide_groups`, `serp_analyses`, `serp_pages`, `semantic_terms`, `prompts`, `ai_requests`, `prompt_contexts`, `nlp_cache`
  - Row Level Security (RLS) activé
  - Index de performance (migration 002)
- **Cache** : Upstash Redis + ioredis
  - Cache SERP : TTL 24h
  - Cache guide : TTL 5min
  - Cache NLP : Supabase `nlp_cache` table, TTL 7 jours (réduit ~70-80% d'appels TextRazor)

### Infrastructure
- **Auth** : Supabase Auth
- **Package Manager** : pnpm
- **Tests** : Vitest 4.1.0 (~25 fichiers de tests, ~40 tests passing)
- **Linting** : ESLint 9
- **TypeScript** : 5
- **Docker** : `services/nlp/Dockerfile` (multi-stage build Python NLP)
- **Déploiement** : Vercel (web) + Render.com (service NLP Python)
- **Monitoring** : Widgets dashboard TextRazor + SerpAPI usage

---

## 14. ARCHITECTURE DES FICHIERS (carte du projet)

```
serpmantic/
├── apps/web/                          # Next.js 16 application
│   ├── src/
│   │   ├── app/
│   │   │   ├── (dashboard)/dashboard/ # Dashboard avec guide cards
│   │   │   ├── (editor)/guide/[id]/   # Page éditeur principal
│   │   │   ├── api/
│   │   │   │   ├── auth/logout/       # Auth logout
│   │   │   │   ├── guides/            # CRUD guides
│   │   │   │   ├── serp/
│   │   │   │   │   ├── analyze/       # Analyse SERP synchrone
│   │   │   │   │   ├── analyze-v2/    # Analyse SERP async (job queue)
│   │   │   │   │   ├── process-job/   # Background job processor
│   │   │   │   │   ├── process-local/ # Processing local
│   │   │   │   │   └── job-status/    # Polling status
│   │   │   │   ├── ai/
│   │   │   │   │   ├── execute/       # Exécution prompts
│   │   │   │   │   ├── plan/          # Génération plan H2/H3
│   │   │   │   │   ├── intention/     # Analyse intention
│   │   │   │   │   └── meta/          # Génération meta
│   │   │   │   ├── prompts/           # Gestion prompts
│   │   │   │   ├── contexts/          # Gestion contextes
│   │   │   │   ├── nlp-cache/cleanup/ # Nettoyage cache NLP
│   │   │   │   ├── textrazor/usage/   # Monitoring TextRazor
│   │   │   │   ├── serpapi/usage/     # Monitoring SerpAPI
│   │   │   │   └── health/           # Health check
│   │   │   └── api-docs/             # Swagger UI
│   │   ├── components/
│   │   │   ├── ui/                    # 20 composants shadcn (base-nova)
│   │   │   ├── editor/               # TipTap editor + toolbar
│   │   │   ├── analysis/             # 15 panneaux d'analyse
│   │   │   │   ├── analysis-panel.tsx        # Conteneur onglets
│   │   │   │   ├── assistant-panel.tsx       # IAssistant multi-LLM
│   │   │   │   ├── plan-panel.tsx            # Génération plan
│   │   │   │   ├── intention-panel.tsx       # Intention de recherche
│   │   │   │   ├── score-display.tsx         # Score 0-120
│   │   │   │   ├── semantic-terms-list.tsx   # Liste expressions
│   │   │   │   ├── structural-metrics.tsx    # Métriques structurelles
│   │   │   │   ├── avoid-terms-list.tsx      # Termes à éviter
│   │   │   │   ├── serp-benchmark.tsx        # Benchmark SERP
│   │   │   │   ├── meta-panel.tsx            # Meta title/desc
│   │   │   │   ├── links-panel.tsx           # Maillage interne
│   │   │   │   ├── config-panel.tsx          # Configuration
│   │   │   │   ├── context-dialog.tsx        # Dialog contextes
│   │   │   │   ├── context-selector.tsx      # Sélecteur contexte
│   │   │   │   └── serp-analysis-progress.tsx # Barre progression
│   │   │   ├── dashboard/             # Guide cards, create dialog
│   │   │   │   ├── guide-card.tsx
│   │   │   │   ├── create-guide-dialog.tsx
│   │   │   │   ├── textrazor-usage.tsx       # Widget monitoring
│   │   │   │   └── serpapi-usage.tsx          # Widget monitoring
│   │   │   └── providers/             # Error boundary, network errors
│   │   ├── stores/
│   │   │   ├── guide-store.ts         # Guide data + SERP + scoring + UI
│   │   │   ├── editor-store.ts        # TipTap instance + content + selection
│   │   │   ├── ai-store.ts            # AI execution state
│   │   │   └── context-store.ts       # Prompt contexts
│   │   └── lib/
│   │       ├── serp.ts                # SerpAPI integration
│   │       ├── crawler.ts             # Cheerio page scraper
│   │       ├── scoring.ts             # Score 0-120 calculation
│   │       ├── text-utils.ts          # Normalisation texte
│   │       ├── cache.ts               # Redis cache helpers
│   │       ├── nlp-cache.ts           # NLP result cache (Supabase)
│   │       ├── nlp-aggregator.ts      # Client-side NLP aggregation
│   │       ├── rate-limit.ts          # Upstash rate limiting
│   │       ├── logger.ts              # Structured logging
│   │       ├── error-handler.ts       # Standardized API errors
│   │       ├── supabase/              # Supabase client configs
│   │       └── ai/
│   │           ├── router.ts          # LLM provider routing
│   │           ├── executor.ts        # Prompt execution
│   │           ├── context-builder.ts # Context enrichment
│   │           └── outline-builder.ts # Plan H2/H3 generation
│   └── components.json               # shadcn config (style: base-nova)
│
├── services/nlp/                      # Python FastAPI NLP service
│   ├── main.py                        # FastAPI entrypoint (/analyze, /analyze-with-lemmas)
│   ├── textrazor_pipeline.py          # TextRazor v2.0 pipeline (production)
│   ├── pipeline.py                    # Basic NLP fallback (offline)
│   ├── requirements.txt               # Python dependencies
│   └── Dockerfile                     # Multi-stage Docker build
│
├── supabase/migrations/               # 9 migrations
│   ├── 001_initial_schema.sql         # profiles, guides, guide_groups, serp_*
│   ├── 002_add_performance_indexes.sql
│   ├── 003_add_ai_tables.sql          # prompts, ai_requests
│   ├── 004_add_guides_rls.sql
│   ├── 005_fix_guides_rls.sql
│   ├── 006_seed_public_prompts.sql    # 15 prompts publics
│   ├── 007_add_prompt_contexts.sql
│   ├── 008_create_nlp_cache.sql       # Cache NLP per-URL
│   └── 009_fix_nlp_cache_rls.sql
│
├── docs/
│   ├── plans/                         # Architecture & design docs
│   ├── RENDER-DEPLOYMENT-GUIDE.md     # Déploiement NLP sur Render
│   ├── SETUP-UPSTASH.md              # Configuration Redis
│   ├── MONITORING_TEXTRAZOR.md        # Documentation monitoring TextRazor
│   └── MONITORING_SERPAPI.md          # Documentation monitoring SerpAPI
│
└── docker-compose.yml                 # Stack locale (NLP + Redis)
```

---

## 15. RÈGLES MÉTIER IMPORTANTES

1. Score plafonné à 120 — Ne jamais afficher un score > 120
2. Seuil de sur-optimisation — Avertir dès que le score dépasse 100
3. Borne haute = percentile P90 des pages SERP, borne basse = P10
4. Termes à éviter = termes présents dans les pages SERP mais uniquement dans les zones navigation/footer/pub, non corrélés avec le ranking
5. Pages SERP exclues = réseaux sociaux, Wikipédia, sites d'autorité générique non concurrents directs
6. Si un terme n'apparaît pas chez les concurrents, il ne figure pas dans la liste
7. Lemmatisation = 'délégataires' et 'délégataire' sont traités comme un seul terme normalisé
8. Score de page SERP = calculé avec le même algorithme que le score utilisateur (permet la comparaison)
9. Fréquence de refresh SERP = recommandée selon l'analyse de la volatilité des pages concurrentes
10. Prompts publics = partagés entre tous les utilisateurs / prompts privés = propres à l'utilisateur

---

## 16. UX ET PÉDAGOGIE

- Messages d'état toujours contextuels et actionnables (jamais de message vague)
- Vidéos tutorielles intégrées dans chaque module (pas de documentation externe)
- Gamification légère : emojis sur chaque recommandation (OK, manque, trop)
- Progression visible : score + couleur + label qualitatif
- Données SERP exposées : l'utilisateur voit les concurrents et leurs scores (transparence totale)
- Contact direct : email de support visible dans chaque onglet
- Feedback produit : encart 'Des idées ou remarques ?' présent dans tous les modules

---

## 17. DIFFÉRENCIATEURS CLÉS vs CONCURRENTS

- Interface 100% française avec support multilingue natif (FR/EN/IT/DE/ES)
- Borne haute à 120 avec signal de sur-optimisation (approche pédagogique rare)
- Section 'termes à éviter' (analyse en négatif, unique sur le marché)
- Multi-LLM transparent : l'utilisateur voit quel modèle est utilisé pour chaque prompt
- Système de partage collaboratif (lecture/édition)
- Vidéos tutorielles inline dans chaque module
- Recommandation de date de mise à jour du contenu
- Score de chaque page SERP visible pour la comparaison directe

---

## 18. CACHING & PERFORMANCE (implémenté)

### Couche 1 — Redis (Upstash)
- **Cache SERP** : Résultats SerpAPI, TTL 24h — évite les appels redondants
- **Cache Guide** : Contenu guide, TTL 5min — accélère les lectures fréquentes
- **Rate Limiting** : 5 req/h par user pour `/api/serp/analyze`

### Couche 2 — Supabase (NLP Cache)
- **Table** : `nlp_cache` (migration 008) — stockage per-URL des résultats NLP
- **Clé** : SHA-256 hash de `url + language`
- **TTL** : 7 jours (configurable)
- **Impact** : Réduction de ~70-80% des appels TextRazor API
- **Module** : `apps/web/src/lib/nlp-cache.ts` (batch get/set, cleanup)
- **Agrégation** : `apps/web/src/lib/nlp-aggregator.ts` (combine résultats cachés + frais)

### Couche 3 — Analyse complète
- **Table** : `serp_analyses` — cache l'analyse complète d'une requête + langue
- **Vérification** : Avant chaque analyse, check si une analyse récente existe déjà

---

## 19. MONITORING (implémenté)

### Widgets Dashboard
- **TextRazor Usage** : `apps/web/src/components/dashboard/textrazor-usage.tsx`
  - Appels API, requêtes restantes, taux d'utilisation
  - Endpoint : `/api/textrazor/usage`
- **SerpAPI Usage** : `apps/web/src/components/dashboard/serpapi-usage.tsx`
  - Recherches effectuées, quota restant, alertes seuils
  - Endpoint : `/api/serpapi/usage`

### Structured Logging
- JSON en production, colorisé en développement — `apps/web/src/lib/logger.ts`

### Error Handling
- Error boundary React — `apps/web/src/components/error-boundary.tsx`
- Network error provider — `apps/web/src/components/providers/network-error-provider.tsx`
- Standardized API errors — `apps/web/src/lib/error-handler.ts`

---

## 20. TESTS (état actuel)

- **Framework** : Vitest 4.1.0 + @vitejs/plugin-react
- **~25 fichiers de tests**, ~40 tests passing
- **Tests unitaires** : scoring, text-utils, AI router, context-builder, NLP cache, NLP aggregator
- **Tests API** : SERP analyze, guides CRUD, AI endpoints, contexts
- **E2E** : Playwright configuré mais pas de tests écrits
- **Couverture** : ~70% (objectif 80%)

---

## 21. PROCHAINES ÉTAPES PRIORITAIRES

### Déploiement immédiat
1. Appliquer migration `008_create_nlp_cache.sql` sur Supabase
2. Redéployer le service NLP sur Render (endpoint `/analyze-with-lemmas`)

### Fonctionnalités manquantes critiques
1. Algorithme de maillage interne (liens-panel existe mais sans logique)
2. Calcul de la recommandation de date de mise à jour
3. UI de création de prompts utilisateur custom
4. CRUD complet des contextes IA

### Améliorations techniques
1. Pipeline CI/CD (GitHub Actions)
2. Tests E2E Playwright
3. Intégration Sentry pour monitoring erreurs
4. Routing i18n Next.js (/fr/, /en/, /it/, /de/, /es/)

---

## 22. RÈGLES DE TRAVAIL CLAUDE CODE (Contrat de fonctionnement)

Ces règles s'appliquent à chaque session de travail. Elles ne sont pas des suggestions, mais un **contrat**.

### Règle 1 : Priorité au mode Planification
- Avant de toucher au moindre code, **écrire le plan**.
- Si quelque chose tourne mal pendant la tâche, **s'arrêter et replanifier**.
- Ne jamais forcer le passage.

### Règle 2 : Sous-agents pour les problèmes difficiles
- Déléguer le travail complexe à des sous-agents pour garder le contexte principal propre.
- Allouer plus de puissance de calcul à ces tâches déléguées.

### Règle 3 : Boucle d'auto-amélioration
- Chaque leçon apprise est inscrite dans `tasks/lessons.md` comme une règle.
- La session suivante lit ce fichier et l'applique.
- Objectif : réduire le taux d'erreur au fil du temps.

### Règle 4 : Standard de vérification
- Ne **jamais** marquer une tâche comme terminée sans avoir lancé des tests et vérifié les logs.
- Se demander : « Est-ce qu'un ingénieur principal approuverait cela ? »

### Règle 5 : Correction autonome des bugs
- Face à un bug, le corriger directement.
- Pas besoin d'être pris par la main : aller dans les logs, trouver la cause profonde et résoudre le problème.

### Règle 6 : Conventions UI base-nova
- Toujours lire `src/components/ui/*.tsx` avant d'utiliser un composant shadcn.
- Les triggers utilisent `render={<Component />}` au lieu de `asChild`.
- `Select.onValueChange` passe `string | null` — toujours vérifier null.
- Consulter `tasks/lessons.md` pour la liste complète des gotchas.
