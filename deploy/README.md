# 🚀 SERPmantics VPS Deployment Guide

Déploiement complet de SERPmantics sur un VPS Hostinger KVM2.

## 📋 Prérequis

- VPS Hostinger KVM2 avec Ubuntu 20.04+ ou Debian 11+
- Accès SSH root ou sudo
- Nom de domaine configuré (DNS pointant vers le VPS)
- Au moins 2GB RAM et 20GB de stockage

## 🔧 Installation Initiale (Une seule fois)

### 1. Connexion au VPS

```bash
ssh root@votre-ip-vps
```

### 2. Créer un répertoire pour l'application

```bash
mkdir -p /var/www/serpmantic
cd /var/www/serpmantic
```

### 3. Cloner votre repository

```bash
git clone <votre-repo-url> .
```

### 4. Rendre les scripts exécutables

```bash
chmod +x deploy/*.sh
```

### 5. Installer les dépendances système

```bash
sudo bash deploy/install-server.sh
```

Ce script va installer :
- ✅ Docker & Docker Compose
- ✅ Nginx (reverse proxy)
- ✅ Certbot (SSL gratuit)
- ✅ UFW Firewall
- ✅ Fail2Ban (protection contre les attaques)
- ✅ Optimisations système

### 6. Configurer les variables d'environnement

```bash
# Copier votre fichier .env.local
cp /chemin/vers/votre/.env.local apps/web/.env.local

# Éditer si nécessaire
nano apps/web/.env.local
```

**Important** : Mettez à jour `NLP_SERVICE_URL` :
```env
NLP_SERVICE_URL=http://nlp:8001
```

### 7. Configurer Nginx

```bash
# Copier la configuration Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/serpmantic

# Modifier le nom de domaine
sudo nano /etc/nginx/sites-available/serpmantic
# Remplacer "your-domain.com" par votre vrai domaine

# Activer le site
sudo ln -s /etc/nginx/sites-available/serpmantic /etc/nginx/sites-enabled/

# Désactiver le site par défaut
sudo rm /etc/nginx/sites-enabled/default

# Tester la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

### 8. Obtenir un certificat SSL (HTTPS)

```bash
sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com
```

Suivez les instructions de Certbot. Il configurera automatiquement le SSL.

## 🚢 Déploiement

### Déploiement initial

```bash
cd /var/www/serpmantic
sudo bash deploy/deploy.sh production
```

### Déploiements ultérieurs (mises à jour)

```bash
cd /var/www/serpmantic
git pull origin main
sudo bash deploy/deploy.sh production
```

## 🔍 Vérification et Monitoring

### Vérifier que les services fonctionnent

```bash
# Status des containers
docker-compose ps

# Logs en temps réel
docker-compose logs -f

# Logs d'un service spécifique
docker-compose logs -f web
docker-compose logs -f nlp

# Status Nginx
sudo systemctl status nginx

# Vérifier que les ports écoutent
sudo netstat -tlnp | grep -E ':(80|443|3000|8001)'
```

### Tester l'application

```bash
# Test Next.js (via Nginx)
curl -I https://votre-domaine.com

# Test API Next.js
curl https://votre-domaine.com/api/health

# Test NLP Service
curl https://votre-domaine.com/api/nlp/health
```

## 🔄 Gestion des services

### Arrêter les services

```bash
cd /var/www/serpmantic
docker-compose down
```

### Redémarrer les services

```bash
cd /var/www/serpmantic
docker-compose restart
```

### Voir les ressources utilisées

```bash
docker stats
```

### Nettoyer les images Docker inutilisées

```bash
docker system prune -a
```

## 📊 Logs et Debugging

### Logs de déploiement

```bash
tail -f /var/log/serpmantic-deploy.log
```

### Logs Nginx

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

### Logs Docker

```bash
# Tous les logs
docker-compose logs --tail=100

# Logs web uniquement
docker-compose logs --tail=100 web

# Logs NLP uniquement
docker-compose logs --tail=100 nlp
```

## 🔒 Sécurité

### Mise à jour du système

```bash
sudo apt update && sudo apt upgrade -y
```

### Vérifier le firewall

```bash
sudo ufw status
```

### Vérifier Fail2Ban

```bash
sudo fail2ban-client status
```

### Renouvellement automatique SSL

Certbot configure automatiquement un cron job. Vérifier :

```bash
sudo certbot renew --dry-run
```

## 🔧 Dépannage

### Problème : Nginx ne démarre pas

```bash
# Vérifier la configuration
sudo nginx -t

# Voir les logs d'erreur
sudo journalctl -u nginx -n 50
```

### Problème : Docker containers ne démarrent pas

```bash
# Voir les logs détaillés
docker-compose logs

# Reconstruire sans cache
docker-compose build --no-cache
docker-compose up -d
```

### Problème : Port déjà utilisé

```bash
# Vérifier quel processus utilise le port
sudo lsof -i :3000
sudo lsof -i :8001

# Tuer le processus si nécessaire
sudo kill -9 <PID>
```

### Problème : Manque d'espace disque

```bash
# Vérifier l'espace disque
df -h

# Nettoyer Docker
docker system prune -a --volumes

# Supprimer les vieux backups
sudo find /var/backups/serpmantic -mtime +30 -delete
```

### Problème : Service NLP lent

Le service NLP télécharge des modèles spaCy au premier démarrage (peut prendre 5-10 minutes). Vérifier :

```bash
docker-compose logs nlp | grep "download"
```

## 🔄 Rollback (Retour en arrière)

Si un déploiement échoue :

```bash
# Lister les backups
ls -lh /var/backups/serpmantic/

# Restaurer le dernier backup
cd /var/www
sudo rm -rf serpmantic
sudo tar -xzf /var/backups/serpmantic/serpmantic-backup-YYYYMMDD-HHMMSS.tar.gz

# Redémarrer les services
cd serpmantic
docker-compose up -d
```

## 📈 Optimisations de Performance

### Augmenter les workers Next.js

Modifier `docker-compose.yml` :

```yaml
web:
  environment:
    - WEB_CONCURRENCY=4  # Ajuster selon vos CPU cores
```

### Augmenter les workers NLP

Modifier `services/nlp/Dockerfile` :

```dockerfile
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "4"]
```

### Activer le cache Redis

Déjà configuré via Upstash dans votre `.env.local`

## 🆘 Support

En cas de problème :

1. Vérifier les logs : `docker-compose logs`
2. Vérifier le status : `docker-compose ps`
3. Vérifier Nginx : `sudo nginx -t`
4. Vérifier le firewall : `sudo ufw status`

## 📝 Checklist de Déploiement

- [ ] VPS configuré avec install-server.sh
- [ ] Repository cloné dans /var/www/serpmantic
- [ ] Fichier .env.local configuré
- [ ] Nginx configuré avec votre domaine
- [ ] DNS pointant vers le VPS
- [ ] Certificat SSL obtenu
- [ ] Déploiement initial réussi
- [ ] Tests effectués (web + NLP)
- [ ] Monitoring configuré

## 🎯 URLs Importantes

- Application : https://votre-domaine.com
- Health Check Web : https://votre-domaine.com/api/health
- Health Check NLP : https://votre-domaine.com/api/nlp/health
- Swagger NLP : https://votre-domaine.com/api/nlp/docs

---

**Note** : Remplacez `votre-domaine.com` par votre vrai nom de domaine partout dans ce guide.
