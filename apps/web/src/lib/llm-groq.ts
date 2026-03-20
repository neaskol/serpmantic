/**
 * Alternative LLM gratuite avec Groq
 * Remplace Anthropic Claude et OpenAI GPT
 *
 * Avantages :
 * - 100% gratuit (14,400 requêtes/jour)
 * - Ultra-rapide (inférence optimisée)
 * - Modèles open-source performants
 *
 * Limites :
 * - 30 requêtes/minute (suffisant pour MVP)
 * - Qualité légèrement inférieure à GPT-4/Claude
 */

import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Modèles disponibles sur Groq (gratuits)
 */
export const GROQ_MODELS = {
  // Meilleur modèle général (équivalent Claude 3.5 Sonnet) - 2026 update
  LLAMA_70B: 'llama-3.3-70b-versatile',

  // Rapide et léger (équivalent GPT-4o-mini)
  LLAMA_8B: 'llama-3.1-8b-instant',

  // Bon pour la créativité
  MIXTRAL: 'mixtral-8x7b-32768',

  // Léger et rapide
  GEMMA: 'gemma2-9b-it',
} as const;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

/**
 * Génère une completion avec Groq
 */
export async function groqChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
) {
  const {
    model = GROQ_MODELS.LLAMA_70B,
    temperature = 0.7,
    maxTokens = 4096,
    topP = 1,
  } = options;

  try {
    const completion = await groq.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
    });

    return {
      content: completion.choices[0]?.message?.content || '',
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
    };
  } catch (error) {
    console.error('Groq API error:', error);
    throw new Error('Failed to generate completion with Groq');
  }
}

/**
 * Génère un plan H2/H3 optimal
 * (Remplace Claude Sonnet 4.5)
 */
export async function generateContentPlan(
  keyword: string,
  serpData: any,
  context?: string
) {
  const systemPrompt = `Tu es un expert SEO qui génère des plans de contenu optimisés.
Analyse les titres H2/H3 des pages SERP top-10 et crée un plan exhaustif.`;

  const userPrompt = `Mot-clé cible : "${keyword}"

Titres observés dans la SERP :
${serpData.pages.map((p: any) => `- ${p.title}: ${p.headings?.join(', ')}`).join('\n')}

${context ? `Contexte additionnel : ${context}` : ''}

Génère un plan de contenu avec :
- H2 principaux (5-8 sections)
- H3 sous chaque H2 (2-4 sous-sections)
- Couverture complète des thèmes SERP`;

  return groqChatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], {
    model: GROQ_MODELS.LLAMA_70B,
    temperature: 0.8,
  });
}

/**
 * Optimise la sémantique d'un passage
 * (Remplace GPT-5 Mini)
 */
export async function optimizeSemantics(
  text: string,
  missingTerms: string[],
  excessTerms: string[]
) {
  const systemPrompt = `Tu es un rédacteur SEO expert.
Réécris le texte en intégrant naturellement les termes manquants et en réduisant les termes en excès.`;

  const userPrompt = `Texte à optimiser :
${text}

Termes à ajouter (naturellement) : ${missingTerms.join(', ')}
Termes à réduire : ${excessTerms.join(', ')}

Réécris le texte de manière fluide et naturelle.`;

  return groqChatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], {
    model: GROQ_MODELS.LLAMA_8B, // Plus rapide pour l'optimisation
    temperature: 0.7,
  });
}

/**
 * Génère une introduction engageante
 * (Remplace Claude Sonnet 4)
 */
export async function generateIntroduction(
  keyword: string,
  outline: string,
  tone: string = 'professionnel'
) {
  const systemPrompt = `Tu es un rédacteur expert qui écrit des introductions captivantes pour le SEO.`;

  const userPrompt = `Mot-clé : "${keyword}"
Ton : ${tone}
Plan du contenu : ${outline}

Écris une introduction de 150-200 mots qui :
- Capte l'attention immédiatement
- Intègre le mot-clé naturellement
- Annonce le plan
- Donne envie de lire la suite`;

  return groqChatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], {
    model: GROQ_MODELS.LLAMA_70B,
    temperature: 0.8,
  });
}

/**
 * Corrige orthographe et grammaire
 * (Remplace GPT-5 Chat)
 */
export async function correctSpelling(text: string) {
  const systemPrompt = `Tu es un correcteur expert.
Identifie et corrige UNIQUEMENT les fautes d'orthographe et de grammaire.
Conserve le style et le ton originaux.`;

  const userPrompt = `Texte à corriger :
${text}

Liste les corrections nécessaires avec :
- Erreur trouvée
- Correction proposée
- Ligne concernée`;

  return groqChatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], {
    model: GROQ_MODELS.LLAMA_70B,
    temperature: 0.3, // Basse température pour précision
  });
}

/**
 * Analyse l'intention de recherche
 * (Nouveau module)
 */
export async function analyzeSearchIntent(
  keyword: string,
  serpPages: any[]
) {
  const systemPrompt = `Tu es un expert en analyse d'intention de recherche SEO.
Classifie l'intention : informationnelle, transactionnelle, navigationnelle, ou commerciale.`;

  const userPrompt = `Mot-clé : "${keyword}"

Pages SERP :
${serpPages.map(p => `- ${p.title}\n  URL: ${p.url}`).join('\n\n')}

Analyse :
1. Intention principale (informationnel/transactionnel/navigationnel/commercial)
2. Sous-intentions détectées
3. Questions implicites de l'utilisateur
4. Type de contenu attendu`;

  return groqChatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], {
    model: GROQ_MODELS.LLAMA_70B,
    temperature: 0.5,
  });
}

/**
 * Génère meta title et description
 * (Module Meta)
 */
export async function generateMetaTags(
  keyword: string,
  content: string,
  maxTitleLength: number = 60,
  maxDescLength: number = 158
) {
  const systemPrompt = `Tu es un expert SEO qui écrit des meta tags optimisés.`;

  const userPrompt = `Mot-clé principal : "${keyword}"

Contenu (extrait) :
${content.slice(0, 500)}...

Génère :
1. Meta title (max ${maxTitleLength} caractères)
   - Inclut le mot-clé
   - Accrocheur et clair
   - Format : Mot-clé | Bénéfice | Marque

2. Meta description (max ${maxDescLength} caractères)
   - Inclut le mot-clé
   - Appel à l'action
   - Résumé des bénéfices`;

  return groqChatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], {
    model: GROQ_MODELS.LLAMA_70B,
    temperature: 0.7,
  });
}

/**
 * Wrapper pour compatibilité avec l'API existante
 */
export const groqLLM = {
  chat: {
    completions: {
      create: groqChatCompletion,
    },
  },
  models: GROQ_MODELS,

  // Fonctions spécialisées
  generateContentPlan,
  optimizeSemantics,
  generateIntroduction,
  correctSpelling,
  analyzeSearchIntent,
  generateMetaTags,
};

export default groqLLM;
