/**
 * Test complet de toutes les API keys
 * Usage: node scripts/test-all-apis.js
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(color, message) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

// Charger .env.local
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

async function testAllAPIs() {
  console.clear();
  log('cyan', `
╔═══════════════════════════════════════════╗
║   🧪 Test de toutes les API keys          ║
║      SERPmantics                          ║
╚═══════════════════════════════════════════╝
  `);

  const results = {
    supabase: false,
    upstash: false,
    anthropic: false,
    openai: false,
    groq: false,
  };

  // 1. Test Supabase
  log('blue', '\n1️⃣  Test Supabase Database');
  log('cyan', '━'.repeat(50));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    log('red', '❌ Variables manquantes');
  } else {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      if (response.ok || response.status === 404) {
        log('green', '✅ Supabase : Connexion OK');
        console.log(`   URL: ${supabaseUrl}`);
        results.supabase = true;
      } else {
        log('red', `❌ Supabase : Erreur ${response.status}`);
      }
    } catch (error) {
      log('red', `❌ Supabase : ${error.message}`);
    }
  }

  // 2. Test Upstash Redis
  log('blue', '\n2️⃣  Test Upstash Redis');
  log('cyan', '━'.repeat(50));

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!upstashUrl || !upstashToken) {
    log('red', '❌ Variables manquantes');
  } else {
    try {
      const response = await fetch(`${upstashUrl}/ping`, {
        headers: {
          'Authorization': `Bearer ${upstashToken}`,
        },
      });

      const result = await response.json();

      if (result.result === 'PONG') {
        log('green', '✅ Upstash : PONG reçu');
        console.log(`   URL: ${upstashUrl}`);
        results.upstash = true;
      } else {
        log('red', '❌ Upstash : Réponse invalide');
      }
    } catch (error) {
      log('red', `❌ Upstash : ${error.message}`);
    }
  }

  // 3. Test Anthropic Claude
  log('blue', '\n3️⃣  Test Anthropic Claude');
  log('cyan', '━'.repeat(50));

  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    log('red', '❌ Variable ANTHROPIC_API_KEY manquante');
  } else {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 10,
          messages: [
            { role: 'user', content: 'Hello' }
          ],
        }),
      });

      const result = await response.json();

      if (response.ok) {
        log('green', '✅ Anthropic : API key valide');
        console.log(`   Modèle : claude-3-5-sonnet-20241022`);
        console.log(`   Réponse : ${result.content?.[0]?.text || '(OK)'}`);
        results.anthropic = true;
      } else {
        log('red', `❌ Anthropic : ${result.error?.message || 'Erreur inconnue'}`);
      }
    } catch (error) {
      log('red', `❌ Anthropic : ${error.message}`);
    }
  }

  // 4. Test OpenAI GPT
  log('blue', '\n4️⃣  Test OpenAI GPT');
  log('cyan', '━'.repeat(50));

  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    log('red', '❌ Variable OPENAI_API_KEY manquante');
  } else {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 10,
          messages: [
            { role: 'user', content: 'Hello' }
          ],
        }),
      });

      const result = await response.json();

      if (response.ok) {
        log('green', '✅ OpenAI : API key valide');
        console.log(`   Modèle : gpt-4o-mini`);
        console.log(`   Réponse : ${result.choices?.[0]?.message?.content || '(OK)'}`);
        results.openai = true;
      } else {
        log('red', `❌ OpenAI : ${result.error?.message || 'Erreur inconnue'}`);
      }
    } catch (error) {
      log('red', `❌ OpenAI : ${error.message}`);
    }
  }

  // 5. Test Groq (gratuit)
  log('blue', '\n5️⃣  Test Groq (LLM gratuit)');
  log('cyan', '━'.repeat(50));

  const groqKey = process.env.GROQ_API_KEY;

  if (!groqKey) {
    log('red', '❌ Variable GROQ_API_KEY manquante');
  } else {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-70b-versatile',
          max_tokens: 10,
          messages: [
            { role: 'user', content: 'Hello' }
          ],
        }),
      });

      const result = await response.json();

      if (response.ok) {
        log('green', '✅ Groq : API key valide');
        console.log(`   Modèle : llama-3.1-70b-versatile`);
        console.log(`   Réponse : ${result.choices?.[0]?.message?.content || '(OK)'}`);
        results.groq = true;
      } else {
        log('red', `❌ Groq : ${result.error?.message || 'Erreur inconnue'}`);
      }
    } catch (error) {
      log('red', `❌ Groq : ${error.message}`);
    }
  }

  // Résumé
  log('cyan', '\n╔═══════════════════════════════════════════╗');
  log('cyan', '║           📊 Résumé des tests             ║');
  log('cyan', '╚═══════════════════════════════════════════╝\n');

  const total = Object.values(results).length;
  const passed = Object.values(results).filter(Boolean).length;

  console.log(`Supabase Database    : ${results.supabase ? '✅' : '❌'}`);
  console.log(`Upstash Redis        : ${results.upstash ? '✅' : '❌'}`);
  console.log(`Anthropic Claude     : ${results.anthropic ? '✅' : '❌'}`);
  console.log(`OpenAI GPT           : ${results.openai ? '✅' : '❌'}`);
  console.log(`Groq (gratuit)       : ${results.groq ? '✅' : '❌'}`);

  log('cyan', `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (passed === total) {
    log('green', `🎉 Parfait ! ${passed}/${total} services configurés\n`);
    log('cyan', '📝 Prochaines étapes :');
    console.log('  1. Ajouter ces variables dans Vercel');
    console.log('  2. Déployer sur Vercel');
    console.log('  3. Tester /api/health en production\n');
  } else {
    log('yellow', `⚠️  ${passed}/${total} services OK - ${total - passed} à configurer\n`);
    log('cyan', '📝 Services manquants à configurer :');
    if (!results.supabase) console.log('  - Supabase (database)');
    if (!results.upstash) console.log('  - Upstash (cache)');
    if (!results.anthropic) console.log('  - Anthropic (Claude LLM)');
    if (!results.openai) console.log('  - OpenAI (GPT)');
    if (!results.groq) console.log('  - Groq (LLM gratuit)');
    console.log();
  }

  log('blue', '💡 Conseil :');
  console.log('   Groq est gratuit et performant (14k req/jour)');
  console.log('   Utilisez-le pour économiser sur Claude/GPT\n');

  return passed === total;
}

// Exécution
testAllAPIs()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    log('red', `\n❌ Erreur fatale : ${error.message}\n`);
    process.exit(1);
  });
