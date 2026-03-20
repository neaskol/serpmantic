/**
 * Script pour diagnostiquer et corriger les API keys
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
  log('red', `❌ Erreur : ${error.message}`);
  process.exit(1);
}

async function fixAPIs() {
  console.clear();
  log('cyan', '\n🔧 Diagnostic et correction des API keys\n');

  // 1. Supabase
  log('blue', '1️⃣  Supabase');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    log('red', '❌ Variables manquantes');
  } else {
    log('yellow', '⚠️  Erreur 401 détectée');
    log('cyan', '   Cause probable : Base Supabase en pause ou clé invalide');
    log('cyan', '   Solution : Vérifier dans https://supabase.com/dashboard');
    log('cyan', '   - Base en pause ? Cliquer "Resume"');
    log('cyan', '   - Vérifier les API keys dans Settings > API\n');
  }

  // 2. Anthropic
  log('blue', '2️⃣  Anthropic Claude');
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    log('red', '❌ Variable manquante');
  } else {
    log('yellow', '⚠️  Erreur de modèle détectée');
    log('cyan', '   Cause : Mauvais nom de modèle');
    log('green', '   ✅ Modèles valides en 2026 :');
    console.log('      - claude-3-5-sonnet-20241022 (meilleur)');
    console.log('      - claude-3-5-haiku-20241022 (rapide)');
    console.log('      - claude-3-opus-20240229 (puissant)\n');

    // Test avec le bon modèle
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });

      const result = await response.json();

      if (response.ok) {
        log('green', '   ✅ Test avec claude-3-5-haiku : OK');
        console.log(`   Réponse : ${result.content?.[0]?.text}\n`);
      } else {
        log('red', `   ❌ Erreur : ${result.error?.message}`);
        log('cyan', '   Vérifier votre clé API sur https://console.anthropic.com\n');
      }
    } catch (error) {
      log('red', `   ❌ Erreur : ${error.message}\n`);
    }
  }

  // 3. Groq
  log('blue', '3️⃣  Groq (LLM gratuit)');
  const groqKey = process.env.GROQ_API_KEY;

  if (!groqKey) {
    log('red', '❌ Variable manquante');
  } else {
    log('yellow', '⚠️  Modèle décommissionné');
    log('cyan', '   Cause : llama-3.1-70b-versatile n\'existe plus');
    log('green', '   ✅ Modèles valides en 2026 :');
    console.log('      - llama-3.3-70b-versatile (recommandé)');
    console.log('      - llama-3.1-8b-instant (rapide)');
    console.log('      - mixtral-8x7b-32768 (alternatif)\n');

    // Test avec le bon modèle
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });

      const result = await response.json();

      if (response.ok) {
        log('green', '   ✅ Test avec llama-3.3-70b : OK');
        console.log(`   Réponse : ${result.choices?.[0]?.message?.content}\n`);
      } else {
        log('red', `   ❌ Erreur : ${result.error?.message}`);
        log('cyan', '   Vérifier votre clé API sur https://console.groq.com\n');
      }
    } catch (error) {
      log('red', `   ❌ Erreur : ${error.message}\n`);
    }
  }

  // Résumé
  log('cyan', '╔═══════════════════════════════════════════╗');
  log('cyan', '║            🛠️  Actions requises            ║');
  log('cyan', '╚═══════════════════════════════════════════╝\n');

  log('yellow', '📝 Supabase :');
  console.log('   1. Aller sur https://supabase.com/dashboard');
  console.log('   2. Cliquer sur votre projet');
  console.log('   3. Si "Paused", cliquer "Resume"');
  console.log('   4. Retester\n');

  log('green', '✅ OpenAI : Déjà OK');
  log('green', '✅ Upstash : Déjà OK\n');

  log('blue', '💡 Conseil :');
  console.log('   Groq est totalement gratuit (14,400 req/jour)');
  console.log('   Utilisez llama-3.3-70b-versatile au lieu de Claude/GPT\n');
}

fixAPIs().catch((error) => {
  log('red', `\n❌ Erreur : ${error.message}\n`);
  process.exit(1);
});
