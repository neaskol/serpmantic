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

### 10.1 Pipeline d'analyse SERP (backend)

1. Réception mot-clé + locale (langue, pays, moteur de recherche)
2. Requête API Google Search (ou Bing selon config)
3. Récupération des ~10 premières URLs de la SERP
4. Filtrage des URLs non pertinentes (réseaux sociaux, Wikipedia, etc.)
5. Crawl HTTP de chaque page + extraction du HTML
6. Parsing et nettoyage : suppression navigation, footer, publicités, scripts
7. Extraction du texte éditorial uniquement
8. Calcul des métriques structurelles (word count, headings, paragraphs, links, images, videos, tables, lists)
9. NLP : tokenisation → lemmatisation → normalisation (lowercase, suppression accents)
10. Calcul TF-IDF ou cooccurrence → dictionnaire de termes significatifs
11. Calcul des percentiles (P10-P90) pour les fourchettes d'occurrences
12. Construction du référentiel sémantique stocké en base
13. Calcul du score sémantique de chaque page SERP (score 0-120)

### 10.2 Pipeline de scoring temps réel (frontend)

1. Modification dans l'éditeur → déclenchement (debounce ~500ms)
2. Extraction du texte brut depuis le modèle de l'éditeur
3. NLP local ou appel API : tokenisation + lemmatisation + normalisation
4. Comptage des occurrences pour chaque terme du référentiel SERP
5. Comparaison avec les fourchettes min-max du référentiel
6. Calcul du score global (somme pondérée des termes dans/hors fourchette)
7. Mise à jour de l'UI : score, couleur, compteurs, alertes par terme

### 10.3 Calcul du score global (hypothèse algorithmique)

score = Somme pondérée ( poids_terme × f(occurrences_actuelles, min, max) )

Où f(x, min, max) :
- si x < min → score partiel proportionnel (x/min)
- si min ≤ x ≤ max → score plein (1.0)
- si x > max → pénalité (score réduit)

Score normalisé sur une échelle 0-120.
Seuil vert : ~75-100. Sur-optimisation : > 100 (pénalité affichée).

### 10.4 Architecture IA (IAssistant)

1. Prompt utilisateur sélectionné
2. Enrichissement avec contexte guide (mot-clé, langue, données SERP)
3. Enrichissement avec contexte utilisateur (audience, ton, secteur)
4. Enrichissement avec contenu actuel ou sélection de l'éditeur
5. Routage vers LLM (Anthropic Claude ou OpenAI GPT selon le prompt)
6. Réception du résultat
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
  "model": "claude-sonnet-4-5|gpt-5-chat|gpt-5-mini",
  "promptTemplate": "string (with variables)",
  "scope": "selection|document|full",
  "isPublic": "boolean",
  "ownerId": "string|null",
  "category": "string"
}
```

---

## 12. FEATURES À IMPLÉMENTER (par priorité)

### Priorité 1 — Cœur fonctionnel (MVP)
- [ ] Crawler SERP + extraction NLP des pages
- [ ] Construction du référentiel sémantique (termes + fourchettes)
- [ ] Éditeur WYSIWYG (TipTap recommandé)
- [ ] Scoring temps réel 0-120 avec mise à jour live
- [ ] Liste des expressions avec statuts OK/manque/trop
- [ ] Métriques structurelles avec benchmarks SERP
- [ ] Section 'termes à éviter'
- [ ] Benchmark des pages SERP avec scores

### Priorité 2 — IA et plan
- [ ] Module Plan (génération IA du plan H2/H3)
- [ ] Module IAssistant (bibliothèque de prompts multi-LLM)
- [ ] Module Intention (analyse intention de recherche)
- [ ] Module Meta (titre + description avec génération IA)
- [ ] Optimisation automatique Beta (réécriture IA pour atteindre les fourchettes)

### Priorité 3 — Collaboration et avancé
- [ ] Système de partage (privé/lecture/édition)
- [ ] Module Liens (maillage interne avec groupes de guides)
- [ ] Connexion URL (surveillance de la page publiée)
- [ ] Heatmap sémantique dans l'éditeur
- [ ] Recommandation de date de mise à jour
- [ ] Support multilingue (FR/EN/IT/DE/ES)
- [ ] Contextes personnalisés pour les prompts IA
- [ ] Prompts utilisateurs custom

### Priorité 4 — Fonctionnalités manquantes chez SERPmantics (opportunités)
- [ ] Export PDF/Word du guide
- [ ] Historique des versions (snapshots du contenu)
- [ ] Collaboration temps réel (type Google Docs)
- [ ] Audit d'une URL publiée existante
- [ ] Tableau de bord multi-guides avec suivi du score dans le temps
- [ ] API publique pour intégration CMS (WordPress, Shopify)
- [ ] Mode comparaison avant/après optimisation

---

## 13. STACK TECHNIQUE RECOMMANDÉE

### Frontend
- Framework : Next.js 14+ (App Router)
- Editeur : TipTap (basé ProseMirror, excellent support React)
- UI : Tailwind CSS + shadcn/ui
- State : Zustand ou Jotai (état de l'éditeur + score temps réel)
- Temps réel : debounce sur les modifications + appels API optimisés

### Backend
- API : Node.js (Express ou Fastify) ou Python (FastAPI)
- NLP : spaCy (Python) pour lemmatisation multilingue, ou service dédié
- Crawler : Puppeteer/Playwright pour le rendu JS, Cheerio pour le parsing
- SERP API : SerpApi, DataForSEO, ou ValueSerp
- LLM : Anthropic SDK + OpenAI SDK (multi-LLM routing)
- Queue : Bull/BullMQ pour les jobs de crawl (tâches asynchrones)

### Base de données
- Principale : PostgreSQL (guides, users, prompts, SERP analysis)
- Cache : Redis (résultats SERP mis en cache, scoring fréquent)

### Infrastructure
- Auth : NextAuth.js ou Clerk
- Storage : S3/R2 pour les médias
- Déploiement : Vercel (frontend) + Railway/Render (backend + workers)

---

## 14. RÈGLES MÉTIER IMPORTANTES

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

## 15. UX ET PÉDAGOGIE

- Messages d'état toujours contextuels et actionnables (jamais de message vague)
- Vidéos tutorielles intégrées dans chaque module (pas de documentation externe)
- Gamification légère : emojis sur chaque recommandation (OK, manque, trop)
- Progression visible : score + couleur + label qualitatif
- Données SERP exposées : l'utilisateur voit les concurrents et leurs scores (transparence totale)
- Contact direct : email de support visible dans chaque onglet
- Feedback produit : encart 'Des idées ou remarques ?' présent dans tous les modules

---

## 16. DIFFÉRENCIATEURS CLÉS vs CONCURRENTS

- Interface 100% française avec support multilingue natif (FR/EN/IT/DE/ES)
- Borne haute à 120 avec signal de sur-optimisation (approche pédagogique rare)
- Section 'termes à éviter' (analyse en négatif, unique sur le marché)
- Multi-LLM transparent : l'utilisateur voit quel modèle est utilisé pour chaque prompt
- Système de partage collaboratif (lecture/édition)
- Vidéos tutorielles inline dans chaque module
- Recommandation de date de mise à jour du contenu
- Score de chaque page SERP visible pour la comparaison directe

---

## 17. RÈGLES DE TRAVAIL CLAUDE CODE (Contrat de fonctionnement)

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
