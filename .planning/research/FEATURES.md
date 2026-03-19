# Feature Research: AI Content Assistance Modules

**Domain:** AI-powered SEO content optimization and writing assistance
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

This research analyzes AI content assistance features for four modules to be added to SERPmantics: Plan (outline generation), IAssistant (prompt library), Intention (search intent analysis), and Meta (SEO meta generation). Analysis is based on competitive intelligence from Surfer SEO, NeuronWriter, Frase, and broader AI writing assistant market research.

**Key Finding:** The AI writing assistant market has matured significantly in 2026. Table stakes have shifted from "does it have AI" to "does it prevent over-optimization and maintain human voice." Multi-LLM routing (37% of enterprises use 5+ models) and context-aware prompting are now expected, not differentiators.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any AI SEO content tool. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **AI outline generation from SERP** | All competitors (Surfer, Frase, NeuronWriter) offer this; users won't manually analyze 10 pages | MEDIUM | Must analyze H2/H3 patterns across top 10-30 SERP pages, identify topic clusters, generate coherent structure |
| **One-click outline insertion** | Users expect generated outline to populate editor directly | LOW | Integration with TipTap editor state |
| **Search intent classification** | Core to SEO workflow; Google ranks by intent match (informational/transactional/navigational/commercial) | MEDIUM | LLM analyzes SERP features (featured snippets, PAA boxes, ads density) + page types |
| **Intent-content alignment check** | Not enough to identify intent; must verify content matches it | MEDIUM | Compare user's content against intent criteria (e.g., "informational" needs FAQ, "transactional" needs pricing) |
| **Meta title character counter (60 chars)** | SEO basic; Google truncates at ~60 characters | LOW | Real-time counter with visual warning at threshold |
| **Meta description character counter (155-160 chars)** | SEO basic; Google truncates at ~155-160 characters | LOW | Real-time counter with visual warning at threshold |
| **AI meta title generation** | Manual meta writing is tedious; all tools offer AI generation | LOW | Single LLM call with keyword + content context |
| **AI meta description generation** | Same as title; expected feature | LOW | Single LLM call with keyword + content context |
| **Prompt library with categories** | Users need starting point; blank prompt box has low engagement | LOW | Categorize by use case (grammar, tone, SEO, structure, media) |
| **Prompt execution on selection** | Users expect to select text and apply prompt to that section only | MEDIUM | Requires TipTap selection state + replacement logic |
| **Prompt execution on full document** | Some prompts (outline, intro) apply to whole content | MEDIUM | Operates on entire editor state |
| **Loading state during generation** | AI calls take 2-10 seconds; silence creates confusion | LOW | Spinner + status message ("Generating outline...") |
| **Generation result preview** | Users want to review before accepting (avoid destructive operations) | MEDIUM | Show result in modal/panel with Accept/Reject buttons |
| **Undo support for AI changes** | Users must be able to revert AI suggestions | LOW | TipTap history already supports this; just ensure AI edits are undoable |

### Differentiators (Competitive Advantage)

Features that set SERPmantics apart from Surfer SEO, NeuronWriter, Frase. Not required for basic functionality, but create competitive advantage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Multi-LLM routing with transparency** | 60% cost reduction + quality optimization; users see which model is used for each prompt | MEDIUM | Route grammar/simple tasks → GPT-4o-mini (cheap), complex reasoning → Claude Sonnet 4.5, show model badge on each prompt |
| **SERP-specific prompt context injection** | Competitors use generic prompts; injecting actual SERP data (top terms, competitors' H2s, semantic gaps) creates SEO-specific output | MEDIUM | Enrich prompt with: target keyword, top 5 semantic terms from SERP analysis, competitor H2/H3 structure, structural benchmarks (word count, heading count) |
| **Over-optimization warning in prompts** | SERPmantics already warns at score >100; extend to AI prompts ("Adding this would push semantic score to 115 - over-optimized") | HIGH | Pre-check generated content against semantic scoring engine before showing to user; flag if it would cause over-optimization |
| **Terms-to-avoid integration** | Unique to SERPmantics; AI prompts can be warned against using parasitic terms (navigation, commercial fluff) | MEDIUM | Inject "Avoid these terms: [list]" into prompt context when generating content |
| **Outline validation against SERP coverage** | Generate outline, then check: does it cover topics present in top 3 SERP pages? Show coverage % | HIGH | Compare generated H2/H3 against extracted topics from SERP; highlight missing critical topics |
| **Intent mismatch severity scoring** | Don't just say "your content is transactional but intent is informational" - quantify the gap (0-100% alignment) | MEDIUM | Multi-dimensional scoring: language tone match, structural match (e.g., FAQ presence), CTA density |
| **Custom prompt variables** | Users can define variables like {audience}, {brand_tone}, {product_name} and reuse across prompts | MEDIUM | Template system with variable injection; store user-defined variables per workspace |
| **Prompt version history** | Save iterations of custom prompts so users can A/B test wording | LOW | Simple versioning table: prompt_id, version_number, template, created_at |
| **Meta A/B variant generation** | Generate 3-5 title/description variants with different angles (benefit-focused, curiosity-gap, authority) | LOW | Single LLM call with "generate 5 variants" instruction + categorization |
| **Semantic score prediction for meta** | Show predicted CTR impact: "Using keyword at start may improve CTR by 15%" | MEDIUM | Heuristic scoring based on keyword placement, length, power words |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good on surface but create issues. Deliberately avoid these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Fully automated content generation (no review)** | "Just write the article for me" - users want one-click solution | Over-reliance on AI creates robotic content; Google penalizes pure AI content; loses brand voice | **Assisted writing only**: AI suggests outlines, sections, improvements but user always reviews and edits. Never auto-publish. |
| **Unlimited prompt length** | Users want to paste entire documents as context | LLM context limits (128k tokens); cost explosion; users don't understand token limits | **Smart context summarization**: Auto-summarize long inputs; show token count; warn at 50% context limit |
| **Real-time AI suggestions on every keystroke** | "Like Grammarly but for SEO" | Constant API calls drain budget; latency creates lag; distracting UX | **Debounced suggestions** (500ms delay) OR **manual trigger** ("Optimize this paragraph" button) |
| **Keyword stuffing optimizer** | "Make my content rank by adding more keywords" | SEO over-optimization is penalized; creates unreadable content; contradicts SERPmantics' own score cap at 120 | **Semantic balance checker**: Warn when keyword density exceeds healthy range; suggest synonyms instead of repetition |
| **Generic tone presets ("professional", "casual")** | Easy to implement; users think they want it | Tone is brand-specific; presets create sameness; doesn't leverage user's unique voice | **Voice cloning from examples**: User provides 2-3 sample paragraphs of their brand voice; AI learns and mimics it |
| **Prompt marketplace (users selling prompts)** | Monetization opportunity; community feature | Quality control nightmare; legal liability for bad prompts; maintenance burden | **Curated public library only**: Team-maintained prompts; community can suggest but not publish directly |
| **Auto-apply all AI suggestions** | Speed up workflow | Removes human judgment; can make content worse; users blame tool for bad output | **Batch review mode**: Show all suggestions in sidebar; user clicks Accept/Reject for each; never auto-apply |

---

## Feature Dependencies

```
[SERP Analysis Data]
    └──required by──> [AI Outline Generation]
                           └──enriches──> [Prompt Context Injection]

    └──required by──> [Search Intent Classification]
                           └──required by──> [Intent-Content Alignment]

    └──required by──> [Terms-to-Avoid Integration]

[TipTap Editor State]
    └──required by──> [Prompt Execution on Selection]
    └──required by──> [Prompt Execution on Full Doc]
    └──required by──> [Undo Support for AI Changes]

[Multi-LLM Router]
    └──required by──> [All AI Modules]
                           └──enhances──> [Custom Prompt Variables]

[Semantic Scoring Engine]
    └──required by──> [Over-Optimization Warning]
    └──enhances──> [Outline Validation against SERP]

[User-Defined Variables]
    └──enhances──> [Custom Prompts]
    └──enhances──> [All AI Generation]
```

### Dependency Notes

- **AI Outline Generation requires SERP Analysis Data:** Cannot generate SEO-optimized outline without knowing what top-ranking pages cover. SERP data must include H2/H3 structure extraction.

- **Prompt Context Injection enhances all AI modules:** Adding SERP-specific context (top terms, semantic gaps, competitor structure) differentiates from generic AI tools. This is the core value-add.

- **Intent-Content Alignment requires Intent Classification:** You can't check alignment until you've classified the intent. Two-step process.

- **Over-Optimization Warning requires Semantic Scoring Engine:** Must run generated content through existing scoring algorithm to predict impact on score 0-120.

- **Multi-LLM Router required by all AI modules:** Foundation layer. Without this, stuck with single provider (vendor lock-in, no cost optimization).

- **Custom Prompt Variables enhance Custom Prompts:** Variables like {audience}, {brand_tone} make prompts reusable. Optional but high-value for power users.

---

## Module-Specific Feature Breakdown

### Module 1: Plan (Outline Generation)

**User Workflow:**
1. User has created guide with keyword analysis (SERP data loaded)
2. User clicks "Generate optimal outline" button in Plan tab
3. System analyzes H2/H3 patterns across top 10 SERP pages
4. System identifies topic clusters (e.g., "What is X", "Benefits of X", "How to use X", "X vs Y")
5. System generates outline with H2/H3 structure covering all critical topics
6. User reviews outline in preview modal
7. User clicks "Insert into editor" → outline appears as H2/H3 headings in TipTap
8. User manually expands each section with content

**Critical Features:**
- [ ] H2/H3 extraction from SERP pages (parsing HTML)
- [ ] Topic clustering algorithm (group similar headings)
- [ ] Outline generation LLM call (Claude Sonnet 4.5 recommended per competitor analysis)
- [ ] Outline preview UI with Accept/Reject
- [ ] Insert outline into TipTap as heading nodes
- [ ] Coverage validation: highlight missing SERP topics

**Differentiator:** Show coverage % ("This outline covers 8/10 topics found in top SERP pages. Missing: [topic A], [topic B]")

### Module 2: IAssistant (Prompt Library)

**User Workflow:**
1. User selects text in editor (or works on full document)
2. User opens IAssistant tab, browses prompt library
3. User selects prompt (e.g., "Optimize semantic density", "Add media suggestions", "Fix grammar")
4. System shows prompt details: title, description, which LLM model, expected scope (selection vs full doc)
5. User clicks "Execute"
6. System enriches prompt with context: selected text OR full content, keyword, top semantic terms, terms to avoid, user-defined variables {audience}, {tone}
7. System routes to appropriate LLM (Claude for complex, GPT-4o-mini for simple)
8. System shows result in preview panel
9. User clicks "Apply" → result replaces selection in editor (or inserts at cursor)

**Critical Features:**
- [ ] Prompt library storage (prompt_id, title, description, template, llm_provider, model, scope)
- [ ] 15+ curated public prompts (grammar, tone, semantic optimization, media suggestions, intro/outro, FAQ generation)
- [ ] Prompt categorization (Grammar, Tone, SEO, Structure, Media, Custom)
- [ ] Multi-LLM routing logic (rule-based: grammar → GPT-4o-mini, complex reasoning → Claude Sonnet 4.5)
- [ ] Context injection: keyword, semantic terms, terms-to-avoid, structural benchmarks
- [ ] User-defined variables system ({audience}, {brand_tone}, {product_name})
- [ ] Variable management UI (add/edit/delete variables)
- [ ] Custom prompt creation (user creates own prompts with template variables)
- [ ] Prompt execution on selection
- [ ] Prompt execution on full document
- [ ] Result preview UI with Apply/Cancel
- [ ] Model transparency badge (show which LLM is being used)

**Differentiators:**
- Multi-LLM routing with cost savings (show "This prompt uses GPT-4o-mini - 90% cheaper than GPT-5")
- SERP context injection (inject actual semantic gaps: "Your content is missing these terms: [list]")
- Over-optimization prevention (warn if prompt output would push score >100)

**Complexity Note:** This is the most complex module due to variable system, multi-LLM routing, and context enrichment.

### Module 3: Intention (Search Intent Analysis)

**User Workflow:**
1. User has created guide with keyword analysis (SERP data loaded)
2. User clicks "Identify search intent" button
3. System analyzes SERP features: presence of ads (commercial intent), PAA boxes (informational), comparison tables (commercial investigation), featured snippets (informational), local pack (local intent)
4. System analyzes page types in top 10: product pages (transactional), blog posts (informational), comparison articles (commercial investigation), homepages (navigational)
5. System classifies intent: Informational / Transactional / Navigational / Commercial Investigation / Local (can be multiple)
6. System shows intent classification with confidence % and evidence (e.g., "Informational (85% confidence): 7/10 pages are blog posts; 3 PAA boxes present")
7. User writes content, then clicks "Analyze my content" button
8. System checks content alignment: Does it match the intent? (e.g., if informational, does it answer questions without pushing sale?)
9. System shows alignment score (0-100%) with specific feedback (e.g., "Content is 40% aligned - too many CTAs for informational intent; add FAQ section")

**Critical Features:**
- [ ] SERP feature detection (parse SERP HTML for ads, PAA, featured snippets, local pack, comparison tables)
- [ ] Page type classification (analyze top 10 URLs: product page vs blog vs homepage)
- [ ] Intent classification LLM call (analyze features + page types → classify intent with confidence %)
- [ ] Intent display UI (show classification, confidence, evidence)
- [ ] Content analysis for alignment (analyze user's content for intent signals: FAQ presence, CTA density, tone)
- [ ] Alignment scoring algorithm (0-100% match)
- [ ] Specific alignment feedback ("Add FAQ section", "Reduce CTA density", "Use more educational tone")

**Differentiator:** Multi-dimensional alignment scoring (not just yes/no, but quantified gap with actionable fixes)

**Complexity Note:** SERP feature detection requires robust HTML parsing; may need to use SERP API that provides structured features.

### Module 4: Meta (SEO Meta Generation)

**User Workflow:**
1. User has written content in editor
2. User opens Meta tab
3. User sees two fields: Title (60 char limit) + Meta Description (155-160 char limit)
4. User can manually type OR click "Suggest ideas" button
5. System generates 3-5 variants for both title and description:
   - Benefit-focused: "How to [keyword] - Save 50% Time with This Method"
   - Curiosity-gap: "The [keyword] Secret Top SEO Pros Don't Want You to Know"
   - Authority: "[keyword]: Complete 2026 Guide from [Brand]"
   - Question-based: "What is [keyword]? Everything You Need to Know"
6. User selects preferred variant (or edits manually)
7. User clicks "Save" to store meta with guide
8. System shows semantic score prediction: "Using keyword at start may improve CTR by 15%"

**Critical Features:**
- [ ] Meta title field with real-time character counter (60 char limit)
- [ ] Meta description field with real-time character counter (155-160 char limit)
- [ ] Visual warning when approaching/exceeding limit (yellow at 80%, red at 100%)
- [ ] AI variant generation (3-5 title variants + 3-5 description variants)
- [ ] Variant categorization labels (Benefit, Curiosity, Authority, Question)
- [ ] One-click variant selection (populate field)
- [ ] Copy to clipboard buttons
- [ ] Save functionality (store with guide)
- [ ] Semantic score prediction heuristics (keyword position, power words, length optimization)

**Differentiators:**
- Multiple variant angles (not just 1 suggestion)
- Predicted CTR impact scoring
- Integration with SERP analysis (inject competitor meta patterns)

**Complexity Note:** Lowest complexity module; mostly LLM generation + UI.

---

## MVP Definition

### Launch With (Milestone v1)

Minimum viable AI assistance — what's needed to validate that AI adds value without overwhelming scope.

- [ ] **Module Plan: Basic outline generation** — Core feature; analyze SERP H2/H3, generate outline, insert into editor. No coverage validation yet.
- [ ] **Module IAssistant: 5-8 curated prompts** — Start with essentials: grammar check, semantic optimization, tone humanization, media suggestions. No custom prompts yet.
- [ ] **Module IAssistant: Multi-LLM routing** — Foundation for cost efficiency; route simple prompts to GPT-4o-mini, complex to Claude Sonnet 4.5. User sees model badge.
- [ ] **Module Intention: Intent classification only** — Identify intent from SERP, show classification + confidence. Alignment check deferred to v1.1.
- [ ] **Module Meta: Basic AI generation** — Generate 1 title + 1 description. Character counters. Save functionality. No variants yet.
- [ ] **SERP context injection (basic)** — Inject keyword + top 5 semantic terms into all AI prompts. Terms-to-avoid integration deferred.
- [ ] **Result preview UI** — All AI outputs show in preview before applying (prevents destructive operations).
- [ ] **Undo support** — Ensure TipTap history works with AI changes.

**Why these?** These are table stakes that competitors already have. Shipping without outline generation or intent analysis would make product feel incomplete. Multi-LLM routing is a differentiator but foundational (affects costs, must be in v1).

### Add After Validation (v1.1 - v1.3)

Features to add once core is working and users are engaged.

- [ ] **Custom user prompts** — (v1.1) Power users want to create their own prompts. Add prompt creation UI + template variable support.
- [ ] **User-defined variables system** — (v1.1) {audience}, {brand_tone} variables that enrich prompts. Enhances custom prompts.
- [ ] **Intent-content alignment check** — (v1.2) Completes Intention module; shows alignment score + actionable feedback.
- [ ] **Meta variant generation (3-5 options)** — (v1.2) Differentiate from basic generation; users select preferred angle.
- [ ] **Outline coverage validation** — (v1.2) Show "8/10 SERP topics covered; missing: [X]" after outline generation.
- [ ] **Over-optimization warning for prompts** — (v1.3) Pre-check generated content against semantic score; warn if it would exceed 100.
- [ ] **Terms-to-avoid integration** — (v1.3) Inject parasitic terms into prompt context ("Avoid: cookies, partners, expert").
- [ ] **Prompt library expansion to 15+ prompts** — (v1.3) Add specialized prompts: FAQ generator, comparison table, intro/outro, CTA suggestions.

**Triggers:**
- Custom prompts: User feedback requesting personalization
- Alignment check: Users ask "how do I know if my content matches intent?"
- Variants: Users re-generating metas multiple times (need options, not regeneration)

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Voice cloning from samples** — Learn user's brand voice from example paragraphs. High complexity; deferred until custom prompts prove valuable.
- [ ] **Prompt version history & A/B testing** — Track prompt iterations, compare performance. Deferred until power users exist.
- [ ] **Semantic score prediction for meta** — Predict CTR impact of meta variants. Nice-to-have; not critical for v1.
- [ ] **Batch prompt execution** — Apply prompt to multiple guides at once. Deferred until users have many guides.
- [ ] **Prompt marketplace (curated only)** — Community-suggested prompts reviewed by team. Deferred until user base grows.
- [ ] **Smart context summarization for long docs** — Auto-summarize when hitting token limits. Edge case; deferred.

**Why defer?**
- Voice cloning: Complex ML; validate simpler tone presets work first
- Version history: Power user feature; need power users first
- Batch execution: Multi-guide workflows come later
- Marketplace: Requires moderation infrastructure

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| AI outline generation | HIGH (table stakes) | MEDIUM (H2/H3 parsing + LLM) | P1 |
| Multi-LLM routing | HIGH (cost savings + differentiation) | MEDIUM (routing logic + API integration) | P1 |
| 5-8 curated prompts | HIGH (table stakes) | LOW (template creation) | P1 |
| SERP context injection (basic) | HIGH (differentiation) | LOW (keyword + terms injection) | P1 |
| Intent classification | HIGH (table stakes) | MEDIUM (SERP feature detection + LLM) | P1 |
| Meta AI generation (basic) | MEDIUM (table stakes but simple) | LOW (single LLM call) | P1 |
| Result preview UI | HIGH (prevents destructive ops) | LOW (modal component) | P1 |
| Custom user prompts | MEDIUM (power user request) | MEDIUM (prompt creation UI + storage) | P2 |
| User-defined variables | MEDIUM (enhances custom prompts) | MEDIUM (variable system + injection) | P2 |
| Intent alignment check | MEDIUM (completes Intention module) | MEDIUM (content analysis + scoring) | P2 |
| Meta variant generation | MEDIUM (differentiation) | LOW (multi-output LLM call) | P2 |
| Outline coverage validation | MEDIUM (differentiation) | HIGH (topic extraction + comparison) | P2 |
| Over-optimization warning | LOW (nice-to-have safety) | HIGH (pre-scoring generated content) | P3 |
| Terms-to-avoid integration | LOW (niche use case) | LOW (inject terms list into prompt) | P3 |
| Prompt library expansion (15+) | LOW (incremental value) | LOW (template creation) | P3 |
| Voice cloning | LOW (future enhancement) | HIGH (ML training) | P3 |
| Prompt version history | LOW (power user only) | LOW (versioning table) | P3 |

**Priority key:**
- **P1 (Must have for launch):** AI outline, multi-LLM routing, curated prompts, SERP context, intent classification, meta generation, result preview
- **P2 (Should have, add after v1):** Custom prompts, variables, alignment check, meta variants, coverage validation
- **P3 (Nice to have, future):** Over-optimization warning, terms-to-avoid, library expansion, voice cloning, version history

---

## Competitor Feature Analysis

| Feature | Surfer SEO | NeuronWriter | Frase | SERPmantics Approach |
|---------|------------|--------------|-------|----------------------|
| **AI Outline Generation** | Yes - analyzes H2/H3, auto-generates outline | Yes - analyzes up to 30 SERP pages | Yes - content brief with outline | **Match + Coverage %** - show which SERP topics covered/missing |
| **Multi-LLM Support** | No - single LLM | No - single LLM | No - single LLM | **YES (Differentiator)** - Claude + GPT with transparent routing + cost savings |
| **Prompt Library** | Limited - mostly auto-optimization | No dedicated library | Limited - template-based briefs | **YES - 15+ curated prompts** with categories |
| **Custom User Prompts** | No | No | No | **YES (v1.1)** - create, save, reuse with variables |
| **SERP Context Injection** | Partial - uses SERP data but not explicit in prompts | Yes - deep NLP analysis | Partial - brief includes SERP | **YES (Differentiator)** - inject terms, gaps, structure into every prompt |
| **Intent Classification** | Yes - shows intent for keyword | Yes - identifies intent | Yes - intent analysis in brief | **Match + Alignment Score** - quantify content-intent match |
| **Over-Optimization Prevention** | No - encourages hitting target score | No | No | **YES (Unique)** - warn when score >100, prevent keyword stuffing in prompts |
| **Meta AI Generation** | Yes - basic generation | Yes - generates meta | Yes - meta in brief | **Match + Variants** - 3-5 variants with different angles |
| **Terms to Avoid** | No | No | No | **YES (Unique to SERPmantics)** - inject parasitic terms into prompt context |
| **Voice Cloning** | No | No | No | **Future (v2+)** - learn from examples |

**Competitive Gaps SERPmantics Can Fill:**
1. **Multi-LLM routing** - No competitor offers this; 60% cost savings + quality optimization
2. **Over-optimization prevention** - Competitors push you to hit 100%; SERPmantics warns against it (aligns with core philosophy)
3. **Terms-to-avoid integration** - Unique feature extends to AI prompts
4. **Custom prompts with SERP context** - Power users can create reusable prompts enriched with semantic data

**Where Competitors Lead:**
- **Surfer SEO**: More mature AI integration (128k context, auto-internal linking, humanizer tool)
- **NeuronWriter**: Deeper NLP analysis (Google's own NLP), analyzes up to 30 pages
- **Frase**: Better question research and answer engine optimization

**Strategic Positioning:** SERPmantics should focus on **preventing over-optimization** (align with score cap 120) and **SERP-aware AI** (inject semantic gaps, competitor structure) rather than trying to match Surfer's breadth.

---

## User Workflow Patterns

### Pattern 1: New Content Creation (Outline-First)

**Steps:**
1. Create guide with keyword
2. Wait for SERP analysis (existing feature)
3. Open **Plan** tab → "Generate optimal outline"
4. Review outline, check coverage % ("8/10 SERP topics covered")
5. Accept outline → inserts H2/H3 into editor
6. Open **Intention** tab → "Identify search intent" → sees "Informational (85% confidence)"
7. For each H2 section:
   - Write initial draft
   - Select paragraph → open **IAssistant** → run "Optimize semantic density" prompt
   - Review suggestion, apply if good
8. Open **Meta** tab → "Suggest ideas" → select variant → save

**Critical Path:** Plan → Intention → IAssistant (iterative) → Meta

### Pattern 2: Existing Content Optimization (Audit-First)

**Steps:**
1. Paste existing article into editor
2. See semantic score (existing feature) - e.g., score 65, missing key terms
3. Open **IAssistant** → filter "To Add" terms (existing feature) → run "Optimize semantic density" prompt on full document
4. Review suggested changes, accept relevant ones
5. Open **Intention** tab → "Analyze my content" → sees "40% aligned - too many CTAs"
6. Select CTA-heavy paragraphs → run "Rewrite with educational tone" prompt
7. Re-check alignment → 85% aligned
8. Open **Meta** tab → "Suggest ideas" → update meta for better CTR

**Critical Path:** IAssistant (semantic fix) → Intention (alignment check) → IAssistant (tone fix) → Meta

### Pattern 3: Power User (Custom Workflows)

**Steps:**
1. Create custom prompt: "Generate FAQ section based on SERP analysis" with variables {keyword}, {audience}
2. Save prompt to library
3. Reuse across multiple guides
4. Track prompt performance (v2 feature - version history)

**Critical Path:** Custom Prompt Creation → Variable Management → Reuse

---

## Technical Considerations

### LLM Model Selection Criteria

Based on multi-LLM routing research:

| Task Type | Recommended Model | Reasoning |
|-----------|------------------|-----------|
| Grammar/spelling check | GPT-4o-mini | Simple task; 90% cheaper than GPT-5; fast response |
| Semantic optimization | GPT-4o-mini or GPT-5-mini | Straightforward keyword injection; cost-effective |
| Tone humanization | GPT-5 or Claude Sonnet 4 | Complex linguistic nuance; worth premium cost |
| Outline generation | Claude Sonnet 4.5 | Observed in competitor (SERPmantics audit); handles long context (H2/H3 from 10 pages) well |
| Intent classification | GPT-5 or Claude Sonnet 4.5 | Complex reasoning; needs to analyze multiple signals |
| Media suggestions | GPT-5-mini | Straightforward task; cost-effective |
| Custom prompts | User-selectable OR auto-route based on complexity | Power users may want control; auto-routing as default |

**Routing Implementation:** Rule-based for v1 (hardcode model per prompt type); LLM classifier for v2 (use small model to classify task complexity, then route).

### Context Enrichment Strategy

**What to inject into every AI prompt:**

1. **Keyword** (always): `Target keyword: "delegataire cee"`
2. **Top 5 semantic terms** (always): `Key terms to include: energie, cee, certificats, renovation, prime`
3. **Structural benchmarks** (when relevant): `Target word count: 1500-2200 words; Target headings: 12-23`
4. **Terms to avoid** (v1.3+): `Avoid parasitic terms: cookies, partenaires, expert, offres`
5. **User variables** (v1.1+): `Audience: {audience}; Brand tone: {brand_tone}`
6. **Selected text OR full content**: `Content to optimize: [user's text]`

**Token Budget Management:**
- **Max context per prompt:** 8000 tokens (leaves room for model's max context of 128k)
- **Smart truncation:** If user content + context exceeds 8000 tokens, summarize user content to fit
- **Warning UI:** Show token count; warn at 50% of limit

### Safety & Quality Controls

**Prevent AI Abuse:**

1. **Rate limiting:** 30 AI calls per hour per user (prevent spam)
2. **Content moderation:** Block prompts with abusive language (use OpenAI Moderation API)
3. **Prompt injection protection:** Sanitize user inputs; escape special characters; don't allow users to override system instructions
4. **Cost monitoring:** Track LLM API costs per user; alert if user exceeds $10/day (abnormal usage)

**Quality Assurance:**

1. **Validation:** Check LLM output for empty responses, truncated content, hallucinations (e.g., invented statistics)
2. **Fallback:** If primary LLM fails (timeout, error), retry once with fallback model (e.g., Claude fails → retry with GPT)
3. **User feedback loop:** "Was this helpful?" thumbs up/down on all AI outputs; track to improve prompts

---

## Sources

**AI Outline Generators:**
- [The 5 best AI blog outline generator tools in 2026](https://www.eesel.ai/blog/ai-blog-outline-generator)
- [Blog Content Outline Generator - Surfer SEO](https://surferseo.com/free-article-outline-generator/)
- [Frase — Agentic SEO & GEO Platform](https://www.frase.io/)

**Surfer SEO Features:**
- [Surfer SEO Content Editor: Your Powerful Writing Assistant](https://surferseo.com/content-editor/)
- [Surfer SEO Review 2026: Best Features, Pricing & Results](https://max-productive.ai/ai-tools/surfer-seo/)
- [The 2026 AI SEO Workflow, Backed by Surfer's Top Performers](https://surferseo.com/blog/2026-ai-seo-workflow/)

**Prompt Engineering Best Practices:**
- [The Ultimate Guide to Prompt Engineering in 2026 | Lakera](https://www.lakera.ai/blog/prompt-engineering-guide)
- [How to Write AI Prompts: 12 Tips That Actually Work (2026) | Iternal](https://iternal.ai/how-to-write-ai-prompts)
- [Build an AI prompt library in 5 steps - Ragan Communications](https://www.ragan.com/build-an-ai-prompt-library-in-5-steps/)

**Search Intent Analysis:**
- [How to Analyze Search Intent: The Complete Guide for 2026](https://topicalmap.ai/blog/auto/how-to-analyze-search-intent-2026-guide)
- [Master Search Intent to Dominate Google Rankings in 2026](https://www.clickrank.ai/search-intent-in-seo/)
- [The 6 Types of Search Intent (Including the New Generative AI Intent)](https://seranking.com/blog/search-intent/)

**Meta Description Generators:**
- [Free AI Meta Description Generator | Quattr](https://www.quattr.com/free-tools/meta-description-generator)
- [Meta Description Generator 【Free, No Login, Super easy】](https://seo.ai/tools/meta-description-generator)
- [10 Best Meta Description Generators In 2026 | Juma](https://juma.ai/blog/meta-description-generators)

**Competitor Comparisons:**
- [NeuronWriter vs. Frase](https://neuronwriter.com/neuronwriter-vs-frase/)
- [AI Content Optimization Tools Comparison Guide 2026](https://www.trysight.ai/blog/ai-content-optimization-tools-comparison)
- [The Best SEO Content Optimization Tools in 2026: A Complete Comparison](https://neuronwriter.com/the-best-seo-content-optimization-tools-in-2026-a-complete-comparison/)

**AI Writing Mistakes:**
- [Common AI Writing Mistakes and How to Avoid Them](https://www.yomu.ai/resources/common-ai-writing-mistakes-and-how-to-avoid-them)
- [Top 8 Mistakes People Make With AI Writing Assistants](https://www.godofprompt.ai/blog/top-8-mistakes-people-make-with-ai-writing-assistants)
- [How Marketers Can Avoid Common AI Writing Mistakes](https://www.rellify.com/blog/ai-writing-mistakes)

**Multi-LLM Routing:**
- [The Best LLM in 2026: Gemini 3 vs. Claude 4.5 vs. GPT 5.1](https://www.teneo.ai/blog/the-best-llm-in-2026-gemini-3-vs-claude-4-5-vs-gpt-5-1)
- [LLM Cost Optimization and Multi-Model Routing](https://atlosz.hu/en/blog/llm-koltsegoptimalizalas-routing-strategia/)
- [Multi-Model Routing: Choosing the Best LLM per Task](https://dasroot.net/posts/2026/03/multi-model-routing-llm-selection/)

**UX Workflow:**
- [How to Build Streamlined UX Workflows in 8 Steps | Maze](https://maze.co/blog/ux-workflow/)
- [10 UX Best Practices to Follow in 2026](https://uxpilot.ai/blogs/ux-best-practices)

---

*Feature research for: AI content assistance modules (Plan, IAssistant, Intention, Meta)*
*Researched: 2026-03-19*
*Confidence: HIGH (based on competitive analysis + 2026 market research)*
