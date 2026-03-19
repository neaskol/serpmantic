# SERPmantics API Documentation

Complete API reference for the SERPmantics semantic SEO optimization platform.

## Interactive Documentation

**Swagger UI:** [/api-docs](/api-docs) - Interactive API explorer with live testing

**OpenAPI Spec:** [/api/docs](/api/docs) - Machine-readable OpenAPI 3.0 specification

---

## Table of Contents

1. [Authentication](#authentication)
2. [Rate Limiting](#rate-limiting)
3. [Error Handling](#error-handling)
4. [Endpoints](#endpoints)
   - [Guides](#guides)
   - [SERP Analysis](#serp-analysis)
   - [Health & Monitoring](#health--monitoring)
5. [Data Models](#data-models)

---

## Authentication

All API endpoints require authentication via **Supabase session cookie**.

### Session Cookie

- **Name:** `sb-access-token`
- **Type:** HTTP-only secure cookie
- **Lifetime:** 7 days (configurable)
- **Refresh:** Automatic via refresh token

### Authentication Flow

```typescript
// 1. Login via Supabase client
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

// 2. Session cookie is automatically set
// 3. All subsequent API calls include the cookie

// 4. Logout
await supabase.auth.signOut()
```

### Unauthorized Responses

```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

**Status Code:** `401 Unauthorized`

---

## Rate Limiting

Different endpoints have different rate limits:

| Endpoint | Limit | Window | Identifier |
|----------|-------|--------|------------|
| `/api/guides` | 100 req | 1 minute | User ID |
| `/api/guides/[id]` | 100 req | 1 minute | User ID |
| `/api/serp/analyze` | 5 req | 1 hour | IP address |

### Rate Limit Headers

All responses include rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1711234567
```

### Rate Limit Exceeded Response

```json
{
  "error": "Rate limit exceeded",
  "message": "You have exceeded the maximum number of SERP analyses per hour (5). Please try again later.",
  "limit": 5,
  "remaining": 0,
  "reset": "2026-03-19T14:30:00.000Z"
}
```

**Status Code:** `429 Too Many Requests`

**Additional Header:**
```http
Retry-After: 3600
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `VALIDATION_ERROR` | 400 | Invalid request data (Zod validation) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `NOT_FOUND` | 404 | Resource not found |
| `INTERNAL_ERROR` | 500 | Server error |

### Validation Errors

Zod validation errors include detailed field information:

```json
{
  "error": "Validation error",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "path": ["keyword"],
      "message": "Required"
    }
  ]
}
```

---

## Endpoints

### Guides

#### `GET /api/guides`

List all content guides for the authenticated user, ordered by last updated.

**Authentication:** Required

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "keyword": "delegataire cee",
    "language": "fr",
    "search_engine": "google.fr",
    "content": { "type": "doc", "content": [] },
    "meta_title": "Guide complet du délégataire CEE",
    "meta_description": "Tout savoir sur le métier de délégataire CEE en 2026",
    "score": 93,
    "created_at": "2026-03-19T10:00:00.000Z",
    "updated_at": "2026-03-19T12:00:00.000Z"
  }
]
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `500` - Internal server error

---

#### `POST /api/guides`

Create a new content guide.

**Authentication:** Required

**Request Body:**
```json
{
  "keyword": "delegataire cee",
  "language": "fr",
  "searchEngine": "google.fr"
}
```

**Fields:**
- `keyword` (string, required) - Target SEO keyword
- `language` (enum, required) - `fr` | `en` | `it` | `de` | `es`
- `searchEngine` (string, required) - e.g., `google.fr`, `google.com`

**Response:** Same as GET /api/guides (single guide object)

**Status Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Unauthorized
- `500` - Internal server error

---

#### `GET /api/guides/{id}`

Retrieve a single guide with all related SERP analysis data.

**Authentication:** Required

**Parameters:**
- `id` (path, UUID, required) - Guide unique identifier

**Response:**
```json
{
  "guide": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "keyword": "delegataire cee",
    "content": { "type": "doc", "content": [] },
    "score": 93
  },
  "analysis": {
    "keyword": "delegataire cee",
    "language": "fr",
    "semantic_terms": [...],
    "structural_benchmarks": {...},
    "terms_to_avoid": ["cookies", "secteurs"]
  },
  "pages": [...],
  "terms": [...]
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `404` - Guide not found
- `500` - Internal server error

---

#### `PATCH /api/guides/{id}`

Update guide content, meta tags, or other properties.

**Authentication:** Required

**Parameters:**
- `id` (path, UUID, required) - Guide unique identifier

**Request Body:**
```json
{
  "content": { "type": "doc", "content": [] },
  "meta_title": "Updated title",
  "meta_description": "Updated description"
}
```

**Fields (all optional):**
- `content` (object) - TipTap editor JSON content
- `meta_title` (string, max 60) - SEO title
- `meta_description` (string, max 158) - SEO description
- `keyword` (string) - Target keyword
- `language` (enum) - Content language

**Response:** Updated guide object

**Status Codes:**
- `200` - Success
- `400` - Validation error
- `401` - Unauthorized
- `404` - Guide not found
- `500` - Internal server error

---

#### `DELETE /api/guides/{id}`

Permanently delete a guide and all related data.

**Authentication:** Required

**Parameters:**
- `id` (path, UUID, required) - Guide unique identifier

**Response:**
```json
{
  "success": true
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `404` - Guide not found
- `500` - Internal server error

**⚠️ Warning:** This operation cannot be undone. All SERP analysis data, pages, and semantic terms linked to this guide will be permanently deleted.

---

### SERP Analysis

#### `POST /api/serp/analyze`

Analyze Google SERP results for a keyword to extract semantic terms and structural benchmarks.

**Authentication:** Required

**Rate Limit:** 5 requests/hour per IP address

**Caching:** Results cached for 24 hours

**Request Body:**
```json
{
  "keyword": "delegataire cee",
  "language": "fr",
  "searchEngine": "google.fr",
  "guideId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Fields:**
- `keyword` (string, required) - Target SEO keyword
- `language` (enum, required) - `fr` | `en` | `it` | `de` | `es`
- `searchEngine` (string, required) - Target search engine
- `guideId` (UUID, required) - Guide to link analysis to

**Response:**
```json
{
  "keyword": "delegataire cee",
  "language": "fr",
  "analyzed_at": "2026-03-19T12:00:00.000Z",
  "semantic_terms": [
    {
      "term": "cee",
      "display_term": "CEE",
      "min_occurrences": 8,
      "max_occurrences": 15,
      "is_main_keyword": true,
      "type": "unigram"
    }
  ],
  "structural_benchmarks": {
    "words": { "min": 1096, "max": 2202 },
    "headings": { "min": 12, "max": 23 },
    "paragraphs": { "min": 18, "max": 62 },
    "links": { "min": 12, "max": 50 },
    "images": { "min": 4, "max": 9 },
    "videos": { "min": 0, "max": 1 },
    "tables": { "min": 0, "max": 1 },
    "lists": { "min": 6, "max": 13 }
  },
  "terms_to_avoid": ["cookies", "partenaires", "secteurs"],
  "pages": [...]
}
```

**Response Headers:**
```http
X-Cache: HIT|MISS
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1711234567
```

**Status Codes:**
- `200` - Success
- `400` - Validation error
- `401` - Unauthorized
- `429` - Rate limit exceeded
- `500` - Internal server error

**Process Overview:**
1. Rate limit check
2. Cache lookup (24h TTL)
3. Fetch top 10 SERP results (if cache miss)
4. Crawl and extract content from each page
5. NLP analysis: tokenization → lemmatization → TF-IDF
6. Calculate percentile benchmarks (P10-P90)
7. Store results in database
8. Return analysis + cache for 24h

---

### Health & Monitoring

#### `GET /api/health`

System health check endpoint.

**Authentication:** Not required

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-19T12:00:00.000Z",
  "version": "1.0.0"
}
```

**Status Codes:**
- `200` - Healthy
- `503` - Service unavailable

---

## Data Models

### Guide

```typescript
interface Guide {
  id: string;                    // UUID
  user_id: string;               // Owner UUID
  keyword: string;               // Target SEO keyword
  language: 'fr' | 'en' | 'it' | 'de' | 'es';
  search_engine: string;         // e.g., 'google.fr'
  content: JSONContent;          // TipTap editor JSON
  meta_title?: string;           // Max 60 chars
  meta_description?: string;     // Max 158 chars
  score: number;                 // 0-120
  created_at: string;            // ISO 8601
  updated_at: string;            // ISO 8601
}
```

### SERP Analysis

```typescript
interface SerpAnalysis {
  keyword: string;
  language: string;
  analyzed_at: string;
  semantic_terms: SemanticTerm[];
  structural_benchmarks: StructuralBenchmarks;
  terms_to_avoid: string[];
  pages: SerpPage[];
}
```

### Semantic Term

```typescript
interface SemanticTerm {
  term: string;                  // Normalized (lowercase, no accents)
  display_term: string;          // Original with accents/case
  min_occurrences: number;       // P10 percentile
  max_occurrences: number;       // P90 percentile
  is_main_keyword: boolean;
  type: 'unigram' | 'bigram' | 'trigram' | 'phrase';
  importance?: number;           // Weight for scoring
}
```

### Structural Benchmarks

```typescript
interface StructuralBenchmarks {
  words: { min: number; max: number };
  headings: { min: number; max: number };
  paragraphs: { min: number; max: number };
  links: { min: number; max: number };
  images: { min: number; max: number };
  videos: { min: number; max: number };
  tables: { min: number; max: number };
  lists: { min: number; max: number };
}
```

---

## Best Practices

### Caching

- SERP analyses are cached for 24 hours
- Check `X-Cache: HIT` header to verify cache usage
- Force refresh by waiting 24h or deleting cached analysis

### Rate Limits

- SERP analysis is rate-limited to 5 req/hour to reduce API costs
- Monitor `X-RateLimit-Remaining` header
- Plan batch analyses accordingly

### Error Handling

```typescript
try {
  const response = await fetch('/api/guides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword, language, searchEngine })
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('API Error:', error.error, error.code);
    // Handle specific error codes
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      // Wait until reset time
    }
  }

  const guide = await response.json();
} catch (err) {
  console.error('Network error:', err);
}
```

### Authentication

```typescript
// Check auth status before API calls
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  // Redirect to login
}
```

---

## Related Documentation

- [Testing Guide](./testing.md) - API testing patterns
- [Monitoring Guide](../../../docs/monitoring.md) - Observability and metrics
- [Swagger UI](/api-docs) - Interactive API explorer

---

**Last Updated:** March 19, 2026
**Version:** 1.0.0
