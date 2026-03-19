import { createSwaggerSpec } from 'next-swagger-doc';

export const getApiDocs = () => {
  const spec = createSwaggerSpec({
    apiFolder: 'src/app/api',
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'SERPmantics API',
        version: '1.0.0',
        description: `
# SERPmantics API Documentation

SERPmantics is a SaaS tool for semantic SEO optimization based on SERP analysis.

## Authentication
All API endpoints require authentication via Supabase session cookie.

## Rate Limiting
- Default: 100 requests per minute per IP
- Authenticated: 1000 requests per minute per user

## Error Responses
All errors follow this format:
\`\`\`json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
\`\`\`

### Common Error Codes
- \`UNAUTHORIZED\`: Missing or invalid authentication
- \`VALIDATION_ERROR\`: Invalid request data
- \`RATE_LIMIT_EXCEEDED\`: Too many requests
- \`INTERNAL_ERROR\`: Server error
- \`NOT_FOUND\`: Resource not found
        `.trim(),
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
        {
          url: 'https://app.serpmantics.com',
          description: 'Production server',
        },
      ],
      tags: [
        {
          name: 'Guides',
          description: 'Content guide management endpoints',
        },
        {
          name: 'SERP Analysis',
          description: 'SERP crawling and semantic analysis endpoints',
        },
        {
          name: 'Health',
          description: 'System health and monitoring endpoints',
        },
      ],
      components: {
        securitySchemes: {
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'sb-access-token',
            description: 'Supabase session cookie',
          },
        },
        schemas: {
          Error: {
            type: 'object',
            required: ['error'],
            properties: {
              error: {
                type: 'string',
                description: 'Error message',
              },
              code: {
                type: 'string',
                description: 'Error code',
              },
            },
          },
          Guide: {
            type: 'object',
            required: ['id', 'keyword', 'content', 'createdAt', 'updatedAt'],
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'Guide unique identifier',
              },
              keyword: {
                type: 'string',
                description: 'Target SEO keyword',
                example: 'delegataire cee',
              },
              language: {
                type: 'string',
                enum: ['fr', 'en', 'it', 'de', 'es'],
                default: 'fr',
                description: 'Content language',
              },
              content: {
                type: 'object',
                description: 'TipTap editor content (JSON)',
              },
              metaTitle: {
                type: 'string',
                maxLength: 60,
                description: 'SEO meta title',
              },
              metaDescription: {
                type: 'string',
                maxLength: 158,
                description: 'SEO meta description',
              },
              score: {
                type: 'number',
                minimum: 0,
                maximum: 120,
                description: 'Semantic optimization score',
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
              },
              updatedAt: {
                type: 'string',
                format: 'date-time',
              },
            },
          },
          SerpAnalysis: {
            type: 'object',
            required: ['keyword', 'semanticTerms', 'structuralBenchmarks'],
            properties: {
              keyword: {
                type: 'string',
                description: 'Analyzed keyword',
              },
              language: {
                type: 'string',
                enum: ['fr', 'en', 'it', 'de', 'es'],
              },
              semanticTerms: {
                type: 'array',
                description: 'Semantic terms extracted from SERP',
                items: {
                  type: 'object',
                  properties: {
                    term: {
                      type: 'string',
                      description: 'Normalized term (lowercase, no accents)',
                    },
                    displayTerm: {
                      type: 'string',
                      description: 'Original term with accents/case',
                    },
                    minOccurrences: {
                      type: 'number',
                      description: 'Minimum recommended occurrences (P10)',
                    },
                    maxOccurrences: {
                      type: 'number',
                      description: 'Maximum recommended occurrences (P90)',
                    },
                    isMainKeyword: {
                      type: 'boolean',
                      description: 'Whether this is the main keyword',
                    },
                    type: {
                      type: 'string',
                      enum: ['unigram', 'bigram', 'trigram', 'phrase'],
                    },
                  },
                },
              },
              structuralBenchmarks: {
                type: 'object',
                description: 'Structural metrics benchmarks from SERP',
                properties: {
                  words: {
                    type: 'object',
                    properties: {
                      min: { type: 'number' },
                      max: { type: 'number' },
                    },
                  },
                  headings: {
                    type: 'object',
                    properties: {
                      min: { type: 'number' },
                      max: { type: 'number' },
                    },
                  },
                  paragraphs: {
                    type: 'object',
                    properties: {
                      min: { type: 'number' },
                      max: { type: 'number' },
                    },
                  },
                  links: {
                    type: 'object',
                    properties: {
                      min: { type: 'number' },
                      max: { type: 'number' },
                    },
                  },
                  images: {
                    type: 'object',
                    properties: {
                      min: { type: 'number' },
                      max: { type: 'number' },
                    },
                  },
                  videos: {
                    type: 'object',
                    properties: {
                      min: { type: 'number' },
                      max: { type: 'number' },
                    },
                  },
                  tables: {
                    type: 'object',
                    properties: {
                      min: { type: 'number' },
                      max: { type: 'number' },
                    },
                  },
                  lists: {
                    type: 'object',
                    properties: {
                      min: { type: 'number' },
                      max: { type: 'number' },
                    },
                  },
                },
              },
              termsToAvoid: {
                type: 'array',
                description: 'Terms that correlate with lower ranking',
                items: { type: 'string' },
              },
            },
          },
        },
      },
      security: [
        {
          cookieAuth: [],
        },
      ],
    },
  });

  return spec;
};
