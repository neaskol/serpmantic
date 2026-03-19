-- Seed 15 public prompts for IAssistant
-- Uses ON CONFLICT DO NOTHING to allow re-running migration safely

INSERT INTO prompts (id, title, description, llm_provider, model_id, task_type, prompt_template, system_prompt, scope, is_public, owner_id, category)
VALUES
  -- 1. Construction plan Hn (Structure, Claude Sonnet 4.5)
  (
    gen_random_uuid(),
    'Construction plan Hn',
    'Genere le plan H2/H3 optimal base sur l''analyse SERP',
    'anthropic',
    'anthropic/claude-sonnet-4-5-20250929',
    'plan_generation',
    'Create an optimal H2/H3 content structure for the keyword "{keyword}".

Key semantic terms to cover (from SERP analysis):
{semantic_terms}

Terms to avoid:
{terms_to_avoid}

Generate a hierarchical outline with:
- 4-7 main H2 sections
- 2-4 H3 subsections under each H2
- Cover all important semantic clusters
- Natural flow from introduction to conclusion

Return only the outline structure.',
    'You are an expert SEO content strategist specializing in semantic analysis and content architecture.',
    'document',
    true,
    NULL,
    'Structure'
  ),

  -- 2. Ecrire une bonne introduction (Redaction, Claude Sonnet 4)
  (
    gen_random_uuid(),
    'Ecrire une bonne introduction',
    'Redige une introduction engageante adaptee au mot-cle cible',
    'anthropic',
    'anthropic/claude-sonnet-4-20250514',
    'introduction',
    'Write a compelling introduction for content targeting the keyword "{keyword}".

Key semantic terms to include naturally:
{semantic_terms}

Context:
- Audience: {audience}
- Tone: {tone}

Requirements:
- Hook the reader in the first sentence
- Clearly state what the content covers
- Include the main keyword naturally
- 100-150 words
- Write in French',
    'You are an expert content writer specializing in SEO-optimized introductions.',
    'document',
    true,
    NULL,
    'Redaction'
  ),

  -- 3. Optimiser la semantique du passage (Optimisation, GPT-4o-mini)
  (
    gen_random_uuid(),
    'Optimiser la semantique du passage',
    'Reecrit le passage selectionne pour ameliorer le score semantique',
    'openai',
    'openai/gpt-4o-mini',
    'semantic_optimization',
    'Rewrite this passage to improve semantic relevance for the keyword "{keyword}":

{selected_text}

Add these missing semantic terms naturally:
{semantic_terms}

Avoid these terms:
{terms_to_avoid}

Maintain the original meaning and tone. Write in French.',
    'You are an expert SEO content optimizer.',
    'selection',
    true,
    NULL,
    'Optimisation'
  ),

  -- 4. Reecrire avec un ton naturel & humain (Redaction, GPT-4o-mini)
  (
    gen_random_uuid(),
    'Reecrire avec un ton naturel & humain',
    'Reformule le texte pour un ton plus naturel et engageant',
    'openai',
    'openai/gpt-4o-mini',
    'content_editing',
    'Rewrite this text with a more natural, human, and engaging tone:

{selected_text}

Requirements:
- Remove robotic or overly formal language
- Use conversational tone while maintaining professionalism
- Keep the same information and length
- Write in French',
    'You are an expert content editor specializing in natural, human-sounding copy.',
    'selection',
    true,
    NULL,
    'Redaction'
  ),

  -- 5. Supprimer les passages sans valeur (Optimisation, GPT-4o)
  (
    gen_random_uuid(),
    'Supprimer les passages sans valeur',
    'Identifie et supprime les passages qui n''apportent pas d''information',
    'openai',
    'openai/gpt-4o',
    'content_editing',
    'Review this content and remove passages that add no value or information:

{content}

Identify:
- Fluff and filler phrases
- Repetitive information
- Obvious statements
- Off-topic digressions

Return the cleaned version. Write in French.',
    'You are an expert content editor focused on clarity and value.',
    'document',
    true,
    NULL,
    'Optimisation'
  ),

  -- 6. Corriger orthographe et grammaire (Correction, GPT-4o)
  (
    gen_random_uuid(),
    'Corriger orthographe et grammaire',
    'Met en evidence les fautes d''orthographe et de grammaire',
    'openai',
    'openai/gpt-4o',
    'grammar_check',
    'Review this French content for spelling and grammar errors:

{content}

For each error found:
1. Quote the error
2. Explain the mistake
3. Provide the correction

Be thorough and educational in your explanations.',
    'You are an expert French grammar and spelling checker.',
    'document',
    true,
    NULL,
    'Correction'
  ),

  -- 7. Suggerer des medias pertinents (Enrichissement, GPT-4o)
  (
    gen_random_uuid(),
    'Suggerer des medias pertinents',
    'Propose des ajouts d''images, videos, tableaux et outils',
    'openai',
    'openai/gpt-4o',
    'media_suggestions',
    'Suggest relevant media additions for this content about "{keyword}":

{content}

For each section, recommend:
- Images: What to show, where to place
- Videos: Topics or tutorials to embed
- Tables: Data comparisons or feature matrices
- Interactive tools: Calculators or configurators

Explain how each addition improves user experience.',
    'You are an expert content strategist specializing in multimedia content.',
    'document',
    true,
    NULL,
    'Enrichissement'
  ),

  -- 8. Ecrire une conclusion efficace (Redaction, Claude Sonnet 4)
  (
    gen_random_uuid(),
    'Ecrire une conclusion efficace',
    'Redige une conclusion qui resume et engage a l''action',
    'anthropic',
    'anthropic/claude-sonnet-4-20250514',
    'introduction',
    'Write an effective conclusion for this content about "{keyword}":

Current content:
{content}

Requirements:
- Summarize key points (3-4 sentences)
- Include a clear call-to-action
- End with forward momentum
- 80-120 words
- Write in French',
    'You are an expert content writer specializing in persuasive conclusions.',
    'document',
    true,
    NULL,
    'Redaction'
  ),

  -- 9. Generer title et meta description (SEO, GPT-4o-mini)
  (
    gen_random_uuid(),
    'Generer title et meta description',
    'Propose des meta title et descriptions optimises SEO',
    'openai',
    'openai/gpt-4o-mini',
    'meta_generation',
    'Generate SEO-optimized meta title and description for content about "{keyword}".

Content summary:
{content}

Requirements:
- Title: Max 60 characters, include keyword
- Description: Max 158 characters, compelling preview
- Both in French
- Use active voice
- Include a value proposition',
    'You are an expert SEO specialist focused on meta tags optimization.',
    'document',
    true,
    NULL,
    'SEO'
  ),

  -- 10. Developper une section (Redaction, Claude Sonnet 4.5)
  (
    gen_random_uuid(),
    'Developper une section',
    'Enrichit et developpe le passage selectionne avec plus de details',
    'anthropic',
    'anthropic/claude-sonnet-4-5-20250929',
    'expand_section',
    'Expand this section with more detail and depth:

{selected_text}

Context: This is for content about "{keyword}"

Add:
- More specific examples
- Additional explanations
- Supporting details
- Relevant context

Target length: 2-3x the original. Write in French.',
    'You are an expert content developer specializing in depth and detail.',
    'selection',
    true,
    NULL,
    'Redaction'
  ),

  -- 11. Simplifier le langage (Redaction, GPT-4o-mini)
  (
    gen_random_uuid(),
    'Simplifier le langage',
    'Reformule le texte pour le rendre plus accessible et lisible',
    'openai',
    'openai/gpt-4o-mini',
    'simplify',
    'Simplify this text for better readability:

{selected_text}

Requirements:
- Use simpler vocabulary
- Shorten complex sentences
- Remove jargon where possible
- Maintain accuracy
- Write in French',
    'You are an expert content editor focused on clarity and accessibility.',
    'selection',
    true,
    NULL,
    'Redaction'
  ),

  -- 12. Ajouter des exemples concrets (Enrichissement, Claude Sonnet 4)
  (
    gen_random_uuid(),
    'Ajouter des exemples concrets',
    'Enrichit le contenu avec des exemples pratiques et illustratifs',
    'anthropic',
    'anthropic/claude-sonnet-4-20250514',
    'add_examples',
    'Add concrete, practical examples to this section:

{selected_text}

Context: Content about "{keyword}"

Add 2-3 specific examples that:
- Illustrate the concepts clearly
- Are relevant and realistic
- Help readers understand application
- Are properly formatted

Write in French.',
    'You are an expert content developer specializing in practical examples.',
    'selection',
    true,
    NULL,
    'Enrichissement'
  ),

  -- 13. Generer une section FAQ (Structure, GPT-4o)
  (
    gen_random_uuid(),
    'Generer une section FAQ',
    'Cree une section de questions frequentes basee sur les intentions de recherche',
    'openai',
    'openai/gpt-4o',
    'plan_generation',
    'Generate a FAQ section for content about "{keyword}".

Based on this content:
{content}

Create 5-7 frequently asked questions with answers:
- Cover common user questions and pain points
- Use question format for each heading
- Provide clear, concise answers (50-100 words each)
- Include semantic terms naturally: {semantic_terms}
- Write in French',
    'You are an expert content strategist specializing in FAQ sections.',
    'document',
    true,
    NULL,
    'Structure'
  ),

  -- 14. Suggerer des ancres de liens (SEO, GPT-4o-mini)
  (
    gen_random_uuid(),
    'Suggerer des ancres de liens',
    'Propose des textes d''ancrage optimises pour le maillage interne',
    'openai',
    'openai/gpt-4o-mini',
    'internal_links',
    'Suggest internal link anchor texts for this content about "{keyword}":

{content}

For each anchor:
- Identify the target concept or page
- Propose natural anchor text (3-6 words)
- Explain the relevance
- Avoid over-optimization

Suggest 5-7 internal linking opportunities. Write in French.',
    'You are an expert SEO specialist focused on internal linking strategy.',
    'document',
    true,
    NULL,
    'SEO'
  ),

  -- 15. Adapter au ton professionnel (Redaction, GPT-4o)
  (
    gen_random_uuid(),
    'Adapter au ton professionnel',
    'Ajuste le registre vers un ton plus professionnel et expert',
    'openai',
    'openai/gpt-4o',
    'content_editing',
    'Rewrite this text with a more professional and expert tone:

{selected_text}

Requirements:
- Use professional vocabulary
- Maintain authority and credibility
- Remove casual expressions
- Keep the same information
- Write in French',
    'You are an expert content editor specializing in professional communication.',
    'selection',
    true,
    NULL,
    'Redaction'
  )
ON CONFLICT DO NOTHING;
