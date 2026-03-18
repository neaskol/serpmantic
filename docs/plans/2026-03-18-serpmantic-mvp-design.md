# SERPmantics MVP — Design Document

**Date:** 2026-03-18
**Scope:** MVP = Editeur TipTap + Onglet Optimisation (scoring semantique temps reel)
**Stack:** Next.js 14 full-stack + Python FastAPI (NLP) + Supabase + SerpApi

---

## 1. Architecture

```
serpmantic/
├── apps/web/                    # Next.js 14 App Router
│   ├── app/
│   │   ├── (auth)/              # Login/register (Supabase Auth)
│   │   ├── (dashboard)/         # Liste des guides
│   │   ├── (editor)/guide/[id]/ # Editeur principal
│   │   └── api/
│   │       ├── serp/            # Crawl SERP (SerpApi + Cheerio)
│   │       ├── nlp/             # Proxy vers micro-service Python
│   │       └── guides/          # CRUD guides
│   ├── components/
│   │   ├── editor/              # TipTap + toolbar
│   │   └── analysis/            # Panneau droit (onglet Optimisation)
│   ├── lib/
│   │   ├── scoring.ts           # Scoring client-side (0-120)
│   │   ├── supabase.ts          # Client Supabase
│   │   └── serp.ts              # Client SerpApi
│   └── stores/                  # Zustand
│       ├── editor-store.ts
│       └── guide-store.ts
├── services/nlp/                # Python FastAPI
│   ├── main.py
│   ├── pipeline.py              # spaCy + TF-IDF
│   ├── languages.py
│   └── requirements.txt
├── supabase/migrations/
└── package.json                 # pnpm workspaces
```

**Flux principal:**
1. User entre un mot-cle → API Route appelle SerpApi → crawl pages → envoie textes au service Python NLP
2. Python lemmatise + TF-IDF → retourne termes + fourchettes + termes a eviter
3. Referentiel stocke en Supabase
4. User ecrit dans TipTap → debounce 500ms → scoring.ts recalcule le score cote client
5. UI met a jour score, statuts des termes, metriques structurelles en temps reel

---

## 2. Schema base de donnees

### profiles
- id (UUID, FK auth.users), email, full_name, plan, credits_remaining, created_at, updated_at

### guides
- id (UUID PK), user_id (FK profiles), keyword, language, search_engine, content (JSONB TipTap), meta_title (max 60), meta_description (max 158), linked_url, group_id, visibility, share_token, score (0-120), created_at, updated_at

### serp_analyses
- id (UUID PK), guide_id (FK guides, UNIQUE), keyword, language, analyzed_at, structural_benchmarks (JSONB), refresh_interval_months, refresh_recommended_at, created_at

### serp_pages
- id (UUID PK), serp_analysis_id (FK), url, title, score, is_excluded, metrics (JSONB), term_occurrences (JSONB), position

### semantic_terms
- id (UUID PK), serp_analysis_id (FK), term, display_term, is_main_keyword, min_occurrences, max_occurrences, importance (FLOAT), term_type, is_to_avoid

### guide_groups
- id (UUID PK), user_id (FK), name, created_at

### prompts
- id (UUID PK), user_id (FK nullable), title, description, llm_provider, model, prompt_template, scope, is_public, category, created_at

### user_contexts
- id (UUID PK), user_id (FK), name, audience, tone, sector, brief, created_at

RLS active sur toutes les tables.

---

## 3. UI Layout

Split resizable (50/50) :
- Gauche : TipTap editor avec toolbar flottante (H1-H6, B/I/U, couleur, alignement, listes, tableaux, images, videos, liens)
- Droite : Panneau d'analyse avec onglets (MVP = Optimisation seul, placeholders pour les 6 autres)
- Header sticky : logo, mot-cle, score temps reel, menu hamburger
- Footer : barre de score coloree

### Onglet Optimisation
1. Score global (0-120) avec jauge coloree + label qualitatif
2. Metriques structurelles (8 indicateurs) avec benchmarks SERP (fourchettes P10-P90)
3. Recommandation mise a jour (frequence + date)
4. Liste expressions semantiques avec filtres (toutes / a ajouter / a supprimer)
5. Boutons : surligner, heatmap
6. Section expressions a eviter
7. Benchmark SERP (liste des pages concurrentes avec scores)

### Composants : shadcn/ui (Tabs, Progress, Badge, Card, Tooltip, ScrollArea) + react-resizable-panels

### State : Zustand
- editorStore : content (JSONContent), plainText (string)
- guideStore : guide, serpAnalysis, score, termStatuses, structuralMetrics, activeTab, filter

---

## 4. Scoring (client-side)

```
Pour chaque terme:
  count = occurrences dans plainText (normalise: lowercase, sans accents)
  si count < min → termScore = (count/min) * importance
  si min <= count <= max → termScore = 1.0 * importance
  si count > max → termScore = max(0.3, 1.0 - (count-max)*0.1) * importance

score = min(120, round(sum(termScores) / sum(importances) * 120))

Labels: 0-30 Mauvais (rouge), 31-55 Moyen (orange), 56-75 Bon (jaune), 76-100 Excellent (vert), 101-120 Sur-optimise (bleu + warning)
```

---

## 5. Pipeline NLP (Python FastAPI)

1. Recoit textes des pages SERP + langue
2. spaCy : tokenise → lemmatise → supprime stopwords
3. Extrait unigrams, bigrams, trigrams
4. TF-IDF sur le corpus → termes significatifs
5. Calcule fourchettes (P10/P90 des occurrences par terme)
6. Detecte termes a eviter (haute frequence brute, faible TF-IDF)
7. Retourne : terms[] + terms_to_avoid[]

---

## 6. Pipeline SERP (API Route Next.js)

1. SerpApi → top 10 URLs
2. Filtre : exclut wikipedia, reseaux sociaux, youtube
3. Cheerio : parse HTML, extrait texte editorial (sans nav/footer/aside)
4. Calcule metriques structurelles par page
5. Envoie textes au service NLP Python
6. Calcule benchmarks structurels (P10-P90)
7. Calcule score de chaque page SERP
8. Calcule refresh_interval
9. Stocke en Supabase
10. Retourne le referentiel au frontend

---

## 7. Decisions techniques

- **Monorepo pnpm workspaces** : un seul repo, deploiements separes
- **Scoring 100% client-side** : pas d'appel reseau a chaque frappe, recalcul local instantane
- **NLP en Python** : spaCy est imbattable pour la lemmatisation multilingue (5 langues)
- **Supabase** : PostgreSQL + Auth + RLS, pas besoin de backend auth custom
- **SerpApi** : fiable, 100 recherches/mois gratuites pour le dev
- **MVP = onglet Optimisation seul** : coeur du produit, les 6 autres onglets en phase 2
