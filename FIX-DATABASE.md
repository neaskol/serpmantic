# 🔧 Fix: Colonne `headings` manquante dans la base de données

## Problème identifié

Toutes les API retournent une erreur 500 car la colonne `headings` n'existe pas dans la table `serp_pages`.

```
Error: column serp_pages.headings does not exist
```

Cette colonne est nécessaire pour le fonctionnement du module Plan (génération de plan H2/H3).

## Solution : Appliquer la migration SQL

### Option 1: Via Supabase Dashboard (Recommandé)

1. **Ouvrez votre Supabase Dashboard** :
   ```
   https://sycxauunnhshuhehsafl.supabase.co
   ```

2. **Allez dans "SQL Editor"** (dans le menu de gauche)

3. **Créez une nouvelle requête** et collez ce SQL :
   ```sql
   ALTER TABLE public.serp_pages
   ADD COLUMN IF NOT EXISTS headings JSONB DEFAULT '[]' NOT NULL;

   COMMENT ON COLUMN public.serp_pages.headings IS
   'Extracted H2/H3 headings from competitor pages. Structure: [{"level": 2, "text": "Heading text", "position": 0}]';
   ```

4. **Cliquez sur "Run"**

5. **Vérifiez** que la migration a fonctionné :
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'serp_pages' AND column_name = 'headings';
   ```

   Vous devriez voir :
   ```
   column_name | data_type
   headings    | jsonb
   ```

### Option 2: Via Supabase CLI (Si installé)

```bash
cd /Users/neaskol/Downloads/AGENTIC\ WORKFLOW/serpmantic
supabase db push
```

## Après avoir appliqué la migration

1. **Redémarrez votre serveur de développement** :
   ```bash
   cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic"
   pnpm dev
   ```

2. **Rechargez la page dans le navigateur** : `Cmd+R`

3. **Testez la génération de plan** :
   - Cliquez sur "Générer le plan optimal"
   - Ça devrait maintenant fonctionner ! 🎉

## Pourquoi cette migration était manquante ?

La migration `007_add_headings_to_serp_pages.sql` existe dans le dépôt mais n'a jamais été appliquée à votre base de données Supabase. Cela arrive quand :
- La base de données a été créée avant que cette migration soit ajoutée au code
- Les migrations n'ont pas été synchronisées avec Supabase

## Vérification post-migration

Pour vérifier que tout fonctionne, testez ces endpoints dans le navigateur :

1. **Guide API** : http://localhost:3000/api/guides/b374fd51-1342-4c35-8a0c-f082f846af3c
   - Devrait retourner le guide avec les données SERP

2. **Plan API** : Cliquez sur "Générer le plan optimal" dans l'interface
   - Devrait générer un plan H2/H3

## Fichiers à nettoyer après le fix

Une fois que tout fonctionne, vous pouvez supprimer ces fichiers de test :
```bash
rm apps/web/test-*.mjs
rm apps/web/test-*.sh
rm apply-migration.mjs
rm FIX-DATABASE.md
```
