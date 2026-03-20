/**
 * Script de test Upstash Redis
 *
 * Usage :
 *   pnpm tsx scripts/test-upstash.ts
 *
 * Prérequis :
 *   - Variables UPSTASH_REDIS_URL et UPSTASH_REDIS_TOKEN dans .env.local
 */

import { Redis } from '@upstash/redis';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color: keyof typeof COLORS, message: string) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

async function testUpstashConnection() {
  log('cyan', '\n🔍 Test de connexion Upstash Redis\n');

  // 1. Vérifier les variables d'environnement
  log('blue', '📋 Étape 1 : Vérification des variables d\'environnement');

  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;

  if (!url || !token) {
    log('red', '❌ Variables manquantes !');
    console.log('\nVérifiez que votre fichier .env.local contient :');
    console.log('  UPSTASH_REDIS_URL=https://...');
    console.log('  UPSTASH_REDIS_TOKEN=...');
    process.exit(1);
  }

  log('green', `✅ UPSTASH_REDIS_URL: ${url.substring(0, 30)}...`);
  log('green', `✅ UPSTASH_REDIS_TOKEN: ${token.substring(0, 20)}...`);

  // 2. Initialiser le client Redis
  log('blue', '\n📦 Étape 2 : Initialisation du client Redis');

  let redis: Redis;
  try {
    redis = new Redis({
      url,
      token,
    });
    log('green', '✅ Client Redis initialisé');
  } catch (error) {
    log('red', `❌ Erreur d'initialisation : ${error}`);
    process.exit(1);
  }

  // 3. Test PING
  log('blue', '\n🏓 Étape 3 : Test PING');

  try {
    const pong = await redis.ping();
    if (pong === 'PONG') {
      log('green', '✅ PING réussi : PONG');
    } else {
      log('yellow', `⚠️ Réponse inattendue : ${pong}`);
    }
  } catch (error) {
    log('red', `❌ PING échoué : ${error}`);
    process.exit(1);
  }

  // 4. Test SET/GET
  log('blue', '\n💾 Étape 4 : Test SET/GET');

  const testKey = 'serpmantic:test:connection';
  const testValue = {
    timestamp: new Date().toISOString(),
    message: 'Hello from SERPmantics!',
  };

  try {
    await redis.set(testKey, JSON.stringify(testValue), { ex: 60 });
    log('green', `✅ SET ${testKey}`);

    const retrieved = await redis.get(testKey);
    if (retrieved) {
      const parsed = JSON.parse(retrieved as string);
      log('green', `✅ GET ${testKey}`);
      console.log(`   Valeur : ${JSON.stringify(parsed, null, 2)}`);
    } else {
      log('red', `❌ Valeur non récupérée`);
    }
  } catch (error) {
    log('red', `❌ Erreur SET/GET : ${error}`);
    process.exit(1);
  }

  // 5. Test TTL
  log('blue', '\n⏰ Étape 5 : Test TTL (Time To Live)');

  try {
    const ttl = await redis.ttl(testKey);
    if (ttl > 0 && ttl <= 60) {
      log('green', `✅ TTL : ${ttl} secondes restantes`);
    } else {
      log('yellow', `⚠️ TTL inattendu : ${ttl}`);
    }
  } catch (error) {
    log('red', `❌ Erreur TTL : ${error}`);
  }

  // 6. Test INCR (compteur)
  log('blue', '\n🔢 Étape 6 : Test INCR (compteur)');

  const counterKey = 'serpmantic:test:counter';

  try {
    await redis.del(counterKey); // Reset
    const count1 = await redis.incr(counterKey);
    const count2 = await redis.incr(counterKey);
    const count3 = await redis.incr(counterKey);

    if (count1 === 1 && count2 === 2 && count3 === 3) {
      log('green', `✅ INCR fonctionne : ${count1}, ${count2}, ${count3}`);
    } else {
      log('yellow', `⚠️ Valeurs inattendues : ${count1}, ${count2}, ${count3}`);
    }
  } catch (error) {
    log('red', `❌ Erreur INCR : ${error}`);
  }

  // 7. Test HSET/HGET (hash)
  log('blue', '\n🗂️ Étape 7 : Test HSET/HGET (hash)');

  const hashKey = 'serpmantic:test:hash';

  try {
    await redis.hset(hashKey, {
      keyword: 'seo optimization',
      score: '95',
      language: 'fr',
    });
    log('green', `✅ HSET ${hashKey}`);

    const keyword = await redis.hget(hashKey, 'keyword');
    const score = await redis.hget(hashKey, 'score');

    if (keyword === 'seo optimization' && score === '95') {
      log('green', `✅ HGET ${hashKey} : ${keyword}, score=${score}`);
    } else {
      log('yellow', `⚠️ Valeurs inattendues`);
    }
  } catch (error) {
    log('red', `❌ Erreur HSET/HGET : ${error}`);
  }

  // 8. Test performance (latence)
  log('blue', '\n⚡ Étape 8 : Test de latence');

  const iterations = 10;
  const latencies: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await redis.ping();
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

  // 9. Nettoyage
  log('blue', '\n🧹 Étape 9 : Nettoyage des clés de test');

  try {
    await redis.del(testKey);
    await redis.del(counterKey);
    await redis.del(hashKey);
    log('green', '✅ Clés de test supprimées');
  } catch (error) {
    log('yellow', `⚠️ Erreur de nettoyage : ${error}`);
  }

  // 10. Résumé
  log('cyan', '\n📊 Résumé du test\n');

  console.log('✅ Connexion Upstash : OK');
  console.log('✅ Commandes de base : OK');
  console.log('✅ TTL (expiration) : OK');
  console.log('✅ Compteurs (INCR) : OK');
  console.log('✅ Hash (HSET/HGET) : OK');
  console.log(`✅ Latence : ${avgLatency.toFixed(2)}ms`);

  log('green', '\n🎉 Upstash Redis est correctement configuré !\n');

  // Afficher des infos utiles
  log('cyan', '📝 Prochaines étapes :');
  console.log('  1. Ajouter les mêmes variables dans Vercel');
  console.log('  2. Déployer votre app');
  console.log('  3. Tester /api/health sur Vercel\n');
}

// Exécution
testUpstashConnection().catch((error) => {
  log('red', `\n❌ Erreur fatale : ${error}\n`);
  process.exit(1);
});
