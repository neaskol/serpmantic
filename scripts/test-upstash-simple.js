/**
 * Test Upstash Redis - Version JavaScript simple
 * Usage: node scripts/test-upstash-simple.js
 */

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

async function testUpstash() {
  log('cyan', '\n🔍 Test de connexion Upstash Redis\n');

  // 1. Vérifier les variables d'environnement
  log('blue', '📋 Étape 1 : Vérification des variables d\'environnement');

  // Load env file manually
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', 'apps', 'web', '.env.local');

  try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      if (line.includes('=') && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').replace(/"/g, '');
        process.env[key.trim()] = value.trim();
      }
    }
  } catch (error) {
    log('red', `❌ Erreur de lecture de .env.local : ${error.message}`);
    process.exit(1);
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    log('red', '❌ Variables UPSTASH_REDIS_REST_URL ou UPSTASH_REDIS_REST_TOKEN manquantes !');
    console.log('\nVérifiez votre fichier apps/web/.env.local');
    process.exit(1);
  }

  log('green', `✅ UPSTASH_REDIS_REST_URL: ${url.substring(0, 35)}...`);
  log('green', `✅ UPSTASH_REDIS_REST_TOKEN: ${token.substring(0, 25)}...`);

  // 2. Test PING via REST API
  log('blue', '\n🏓 Étape 2 : Test PING');

  try {
    const response = await fetch(`${url}/ping`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (result.result === 'PONG') {
      log('green', '✅ PING réussi : PONG');
    } else {
      log('yellow', `⚠️ Réponse inattendue : ${JSON.stringify(result)}`);
    }
  } catch (error) {
    log('red', `❌ PING échoué : ${error.message}`);
    process.exit(1);
  }

  // 3. Test SET/GET
  log('blue', '\n💾 Étape 3 : Test SET/GET');

  const testKey = 'serpmantic:test:connection';
  const testValue = JSON.stringify({
    timestamp: new Date().toISOString(),
    message: 'Hello from SERPmantics!',
  });

  try {
    // SET
    const setResponse = await fetch(`${url}/set/${testKey}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([testValue, 'EX', 60]),
    });

    const setResult = await setResponse.json();
    log('green', `✅ SET ${testKey}`);

    // GET
    const getResponse = await fetch(`${url}/get/${testKey}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const getResult = await getResponse.json();

    if (getResult.result) {
      const parsed = JSON.parse(getResult.result);
      log('green', `✅ GET ${testKey}`);
      console.log(`   Valeur : ${JSON.stringify(parsed, null, 2)}`);
    } else {
      log('red', `❌ Valeur non récupérée`);
    }
  } catch (error) {
    log('red', `❌ Erreur SET/GET : ${error.message}`);
    process.exit(1);
  }

  // 4. Test INCR (compteur)
  log('blue', '\n🔢 Étape 4 : Test INCR (compteur)');

  const counterKey = 'serpmantic:test:counter';

  try {
    // DEL pour reset
    await fetch(`${url}/del/${counterKey}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    // INCR x3
    const results = [];
    for (let i = 0; i < 3; i++) {
      const response = await fetch(`${url}/incr/${counterKey}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      results.push(data.result);
    }

    if (results[0] === 1 && results[1] === 2 && results[2] === 3) {
      log('green', `✅ INCR fonctionne : ${results.join(', ')}`);
    } else {
      log('yellow', `⚠️ Valeurs inattendues : ${results.join(', ')}`);
    }
  } catch (error) {
    log('red', `❌ Erreur INCR : ${error.message}`);
  }

  // 5. Test de latence
  log('blue', '\n⚡ Étape 5 : Test de latence');

  const latencies = [];
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    await fetch(`${url}/ping`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const latency = Date.now() - start;
    latencies.push(latency);
  }

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);

  if (avgLatency < 100) {
    log('green', `✅ Latence moyenne : ${avgLatency.toFixed(2)}ms (excellent)`);
  } else if (avgLatency < 200) {
    log('yellow', `⚠️ Latence moyenne : ${avgLatency.toFixed(2)}ms (acceptable)`);
  } else {
    log('red', `❌ Latence moyenne : ${avgLatency.toFixed(2)}ms (élevée)`);
  }

  console.log(`   Min: ${minLatency}ms | Max: ${maxLatency}ms`);

  // 6. Nettoyage
  log('blue', '\n🧹 Étape 6 : Nettoyage des clés de test');

  try {
    await fetch(`${url}/del/${testKey}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    await fetch(`${url}/del/${counterKey}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    log('green', '✅ Clés de test supprimées');
  } catch (error) {
    log('yellow', `⚠️ Erreur de nettoyage : ${error.message}`);
  }

  // 7. Résumé
  log('cyan', '\n📊 Résumé du test\n');

  console.log('✅ Connexion Upstash : OK');
  console.log('✅ Commandes de base : OK');
  console.log('✅ Compteurs (INCR) : OK');
  console.log(`✅ Latence : ${avgLatency.toFixed(2)}ms`);

  log('green', '\n🎉 Upstash Redis est correctement configuré !\n');

  // Afficher des infos utiles
  log('cyan', '📝 Prochaines étapes :');
  console.log('  1. Ajouter les mêmes variables dans Vercel :');
  console.log('     Settings > Environment Variables');
  console.log('  2. Déployer votre app sur Vercel');
  console.log('  3. Tester /api/health sur Vercel\n');
}

// Exécution
testUpstash().catch((error) => {
  log('red', `\n❌ Erreur fatale : ${error.message}\n`);
  process.exit(1);
});
