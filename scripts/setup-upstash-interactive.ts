/**
 * Assistant interactif pour configurer Upstash
 *
 * Usage :
 *   pnpm tsx scripts/setup-upstash-interactive.ts
 */

import * as readline from 'readline';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(color: keyof typeof COLORS, message: string) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function setupUpstash() {
  console.clear();
  log('cyan', `
╔═══════════════════════════════════════════╗
║   🚀 Configuration Upstash Redis          ║
║      Pour SERPmantics                     ║
╚═══════════════════════════════════════════╝
  `);

  // Étape 1 : Instructions
  log('yellow', '\n📋 Avant de commencer, ouvrez un nouvel onglet :');
  console.log('   👉 https://console.upstash.com/login\n');

  const ready = await question('Avez-vous créé un compte Upstash ? (o/n) : ');
  if (ready.toLowerCase() !== 'o') {
    log('blue', '\n📝 Instructions :');
    console.log('  1. Allez sur https://console.upstash.com/login');
    console.log('  2. Connectez-vous avec GitHub ou Google');
    console.log('  3. Aucune carte bancaire requise ✅');
    console.log('  4. Relancez ce script une fois connecté\n');
    process.exit(0);
  }

  // Étape 2 : Création de la base
  log('cyan', '\n🗄️ Étape 1/3 : Création de la base Redis\n');

  log('yellow', '📝 Dans Upstash Console :');
  console.log('  1. Cliquez sur "Create Database"');
  console.log('  2. Name: serpmantic-cache');
  console.log('  3. Type: Regional (gratuit)');
  console.log('  4. Region: Europe (Paris) ou US East');
  console.log('  5. Cliquez sur "Create"\n');

  const created = await question('Base Redis créée ? (o/n) : ');
  if (created.toLowerCase() !== 'o') {
    log('red', '\n❌ Revenez quand la base sera créée.\n');
    process.exit(0);
  }

  // Étape 3 : Récupération des credentials
  log('cyan', '\n🔑 Étape 2/3 : Récupération des credentials\n');

  log('yellow', '📝 Dans Upstash Console > votre base > Details :');
  console.log('  Copiez les valeurs "REST API" (pas Redis CLI)\n');

  const url = await question('UPSTASH_REDIS_REST_URL (https://...) : ');
  if (!url.startsWith('https://')) {
    log('red', '\n❌ URL invalide. Elle doit commencer par https://\n');
    process.exit(1);
  }

  const token = await question('UPSTASH_REDIS_REST_TOKEN : ');
  if (token.length < 20) {
    log('red', '\n❌ Token trop court. Vérifiez que vous avez copié le bon token.\n');
    process.exit(1);
  }

  // Étape 4 : Écriture dans .env.local
  log('cyan', '\n💾 Étape 3/3 : Sauvegarde de la configuration\n');

  const envPath = join(process.cwd(), 'apps', 'web', '.env.local');

  try {
    let envContent = '';

    // Lire le fichier existant
    try {
      envContent = readFileSync(envPath, 'utf-8');
    } catch {
      log('yellow', '⚠️ Fichier .env.local introuvable, création...');
    }

    // Supprimer les anciennes valeurs Upstash si présentes
    envContent = envContent
      .split('\n')
      .filter(line => !line.startsWith('UPSTASH_REDIS_'))
      .join('\n');

    // Ajouter les nouvelles valeurs
    const upstashConfig = `
# Upstash Redis (généré par setup-upstash-interactive.ts)
UPSTASH_REDIS_URL=${url}
UPSTASH_REDIS_TOKEN=${token}
`;

    envContent += upstashConfig;

    writeFileSync(envPath, envContent.trim() + '\n');
    log('green', '✅ Configuration sauvegardée dans apps/web/.env.local');
  } catch (error) {
    log('red', `\n❌ Erreur d'écriture : ${error}\n`);
    process.exit(1);
  }

  // Résumé
  log('cyan', '\n╔═══════════════════════════════════════════╗');
  log('cyan', '║   ✅ Configuration terminée !             ║');
  log('cyan', '╚═══════════════════════════════════════════╝\n');

  log('green', '📝 Prochaines étapes :\n');
  console.log('  1. Testez la connexion :');
  console.log('     pnpm tsx scripts/test-upstash.ts\n');

  console.log('  2. Ajoutez les variables dans Vercel :');
  console.log('     https://vercel.com/[votre-projet]/settings/environment-variables\n');

  console.log('  3. Redéployez sur Vercel\n');

  log('blue', '📚 Documentation complète :');
  console.log('     docs/SETUP-UPSTASH.md\n');

  const testNow = await question('Voulez-vous tester la connexion maintenant ? (o/n) : ');

  rl.close();

  if (testNow.toLowerCase() === 'o') {
    log('yellow', '\n🧪 Lancement du test...\n');

    // Dynamically import to avoid issues
    const { execSync } = require('child_process');
    try {
      execSync('pnpm tsx scripts/test-upstash.ts', { stdio: 'inherit' });
    } catch (error) {
      log('red', '\n❌ Test échoué. Vérifiez les credentials.\n');
    }
  } else {
    log('cyan', '\n👋 À bientôt !\n');
  }
}

// Exécution
setupUpstash().catch((error) => {
  log('red', `\n❌ Erreur : ${error}\n`);
  rl.close();
  process.exit(1);
});
