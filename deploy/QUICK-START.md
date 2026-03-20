# ⚡ Guide de Déploiement Rapide - SERPmantics sur VPS Hostinger

## 🎯 Déploiement en 10 minutes

### Étape 1 : Connexion au VPS (1 min)

```bash
ssh root@VOTRE_IP_VPS
```

### Étape 2 : Installer les dépendances (3-5 min)

```bash
# Télécharger et exécuter le script d'installation
curl -fsSL https://raw.githubusercontent.com/VOTRE-REPO/main/deploy/install-server.sh -o install.sh
chmod +x install.sh
sudo bash install.sh
```

**Alternative** : Si vous avez déjà cloné le repo :

```bash
cd /var/www/serpmantic
chmod +x deploy/install-server.sh
sudo bash deploy/install-server.sh
```

### Étape 3 : Cloner le projet (30 sec)

```bash
cd /var/www/serpmantic
git clone VOTRE_REPO_URL .
```

### Étape 4 : Configuration (1 min)

```bash
# Créer le fichier .env.local
nano apps/web/.env.local
```

Copier-coller votre configuration (ou utiliser SCP/SFTP) :

```env
NEXT_PUBLIC_SUPABASE_URL=https://sycxauunnhshuhehsafl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_key
SUPABASE_SERVICE_ROLE_KEY=votre_key
SERPAPI_KEY=votre_key
NLP_SERVICE_URL=http://nlp:8001
UPSTASH_REDIS_REST_URL=votre_url
UPSTASH_REDIS_REST_TOKEN=votre_token
ANTHROPIC_API_KEY=votre_key
GROQ_API_KEY=votre_key
OPENAI_API_KEY=votre_key
```

Sauvegarder : `Ctrl+X`, puis `Y`, puis `Enter`

### Étape 5 : Configurer Nginx (1 min)

```bash
# Copier la config
sudo cp deploy/nginx.conf /etc/nginx/sites-available/serpmantic

# Éditer pour remplacer le nom de domaine
sudo nano /etc/nginx/sites-available/serpmantic
# Remplacer "your-domain.com" par votre domaine (ex: serpmantic.com)

# Activer
sudo ln -s /etc/nginx/sites-available/serpmantic /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Étape 6 : SSL (1 min)

```bash
sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com
```

### Étape 7 : Déployer ! (2-3 min)

```bash
chmod +x deploy/deploy.sh
sudo bash deploy/deploy.sh production
```

### Étape 8 : Vérifier ✅ (30 sec)

```bash
# Status des services
docker-compose ps

# Test web
curl https://votre-domaine.com/api/health

# Test NLP
curl https://votre-domaine.com/api/nlp/health
```

## 🎉 C'est fait !

Votre application est maintenant accessible sur : **https://votre-domaine.com**

---

## 🔧 Commandes Utiles

### Voir les logs
```bash
docker-compose logs -f
```

### Redémarrer
```bash
docker-compose restart
```

### Mettre à jour
```bash
cd /var/www/serpmantic
git pull origin main
sudo bash deploy/deploy.sh production
```

### Arrêter
```bash
docker-compose down
```

---

## ⚠️ En cas de problème

### Les containers ne démarrent pas ?
```bash
docker-compose logs
```

### Nginx erreur ?
```bash
sudo nginx -t
sudo journalctl -u nginx -n 50
```

### Port déjà utilisé ?
```bash
sudo lsof -i :3000
sudo lsof -i :8001
sudo kill -9 <PID>
```

### Manque de mémoire ?
```bash
free -h
docker stats
```

---

## 📞 Checklist Pré-Déploiement

- [ ] VPS Hostinger KVM2 avec au moins 2GB RAM
- [ ] Ubuntu 20.04+ ou Debian 11+
- [ ] Accès root/sudo
- [ ] Nom de domaine configuré (DNS → IP du VPS)
- [ ] Fichier .env.local prêt
- [ ] Repository Git accessible

---

## 🚀 Prochaines Étapes

1. **Monitoring** : Installer Prometheus + Grafana
2. **Backups** : Configurer des sauvegardes automatiques
3. **CI/CD** : Automatiser les déploiements avec GitHub Actions
4. **Scaling** : Ajouter un load balancer si nécessaire

---

**Besoin d'aide ?** Consultez le [README.md](README.md) complet pour plus de détails.
