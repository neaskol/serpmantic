# Guide de déploiement sur Render.com

## 🎯 Configuration du service NLP Python

Vous êtes à l'étape 2 : **Configure** sur Render.com.

---

## 📝 Configuration à remplir

### 1. Source Code

✅ **Repository sélectionné** : `neaskol/serpmantic`

Cliquez sur "Connect" pour ce repository.

---

### 2. Configure Service

Une fois le repo connecté, remplissez ces champs :

#### Basic Settings

| Champ | Valeur |
|-------|--------|
| **Name** | `serpmantic-nlp` |
| **Region** | Europe (Paris) - `par1` ou Frankfurt - `fra1` |
| **Branch** | `main` |
| **Root Directory** | `services/nlp` |
| **Runtime** | Python 3 |

#### Build & Deploy

| Champ | Valeur |
|-------|--------|
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

#### Instance Type

- Sélectionner : **Free** (0$/mois, 512 MB RAM, 750h/mois)

---

## 🔧 Étapes détaillées

### Étape 1 : Connecter le repository

1. Dans la liste des repositories, chercher **`serpmantic`**
2. Cliquer sur **"Connect"** à droite du nom

### Étape 2 : Remplir la configuration

**Name** :
```
serpmantic-nlp
```

**Region** :
- Choisir **Europe (Paris)** pour réduire la latence

**Root Directory** (IMPORTANT) :
```
services/nlp
```

**Build Command** :
```bash
pip install -r requirements.txt
```

**Start Command** :
```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Étape 3 : Sélectionner le plan Free

En bas de la page, dans "Instance Type" :
- Cliquer sur **Free**
- 512 MB RAM
- $0/mois

### Étape 4 : Variables d'environnement (optionnel)

Si le service NLP a besoin de variables d'environnement, cliquer sur **"Advanced"** et ajouter :

```bash
PYTHON_VERSION=3.11
```

### Étape 5 : Créer le service

Cliquer sur **"Create Web Service"** en bas de la page.

---

## ⏱️ Déploiement en cours

Une fois créé, Render va :
1. ⏳ Cloner le repository (30 secondes)
2. ⏳ Installer les dépendances Python (2-3 minutes)
3. ⏳ Démarrer le service (30 secondes)
4. ✅ Service en ligne !

**Total : ~4-5 minutes**

Vous verrez les logs en temps réel dans l'interface.

---

## 📍 Récupérer l'URL du service

Une fois le déploiement terminé :

1. En haut de la page, vous verrez l'URL :
   ```
   https://serpmantic-nlp.onrender.com
   ```

2. Copier cette URL

3. L'ajouter dans votre `.env.local` :
   ```bash
   NLP_SERVICE_URL=https://serpmantic-nlp.onrender.com
   ```

4. L'ajouter aussi dans **Vercel** (Settings > Environment Variables) :
   ```
   NLP_SERVICE_URL=https://serpmantic-nlp.onrender.com
   ```

---

## ✅ Tester le service

Une fois déployé, tester :

```bash
curl https://serpmantic-nlp.onrender.com/health
```

Devrait retourner :
```json
{
  "status": "ok",
  "service": "nlp"
}
```

---

## ⚠️ Limites du plan gratuit

| Limite | Valeur |
|--------|--------|
| **Veille** | Après 15 minutes d'inactivité |
| **Redémarrage** | ~30-60 secondes au 1er appel |
| **Heures** | 750h/mois (suffisant pour 1 service) |
| **RAM** | 512 MB |
| **Bande passante** | Illimitée |

**Note** : La première requête après veille prendra 30-60 secondes. Les suivantes seront rapides.

---

## 🚨 Troubleshooting

### Erreur : "Build failed"

**Cause** : `requirements.txt` introuvable ou dépendances invalides

**Solution** :
1. Vérifier que `Root Directory` = `services/nlp`
2. Vérifier que `services/nlp/requirements.txt` existe dans le repo

### Erreur : "Service unhealthy"

**Cause** : Port incorrect ou commande de démarrage invalide

**Solution** :
- Start Command doit utiliser `$PORT` (fourni par Render)
- Format : `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Service en veille

**Normal** : Plan gratuit se met en veille après 15 min

**Solution** :
- Première requête = 30-60s (redémarrage)
- Ou upgrade vers plan payant ($7/mois, no sleep)

---

## 📚 Prochaines étapes

1. ✅ Service NLP déployé sur Render
2. Copier l'URL du service
3. Ajouter `NLP_SERVICE_URL` dans Vercel
4. Déployer le frontend sur Vercel
5. Tester l'app complète

---

**Besoin d'aide ?**

Si une erreur apparaît, copiez les logs et je vous aiderai à corriger.
