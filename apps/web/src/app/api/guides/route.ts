import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreateGuideSchema } from '@/lib/schemas'
import { logger } from '@/lib/logger'
import { handleApiError, generateRequestId } from '@/lib/error-handler'

/**
 * @swagger
 * /api/guides:
 *   get:
 *     summary: List all guides
 *     description: Retrieve all content guides for the authenticated user, ordered by last updated
 *     tags:
 *       - Guides
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of guides
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Guide'
 *       401:
 *         description: Unauthorized - missing or invalid authentication
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('guides')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/**
 * @swagger
 * /api/guides:
 *   post:
 *     summary: Create a new guide
 *     description: Create a new content guide with keyword, language, and search engine settings
 *     tags:
 *       - Guides
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keyword
 *               - language
 *               - searchEngine
 *             properties:
 *               keyword:
 *                 type: string
 *                 description: Target SEO keyword
 *                 example: delegataire cee
 *               language:
 *                 type: string
 *                 enum: [fr, en, it, de, es]
 *                 description: Content language
 *                 default: fr
 *               searchEngine:
 *                 type: string
 *                 description: Target search engine for SERP analysis
 *                 example: google.fr
 *     responses:
 *       201:
 *         description: Guide created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Guide'
 *       400:
 *         description: Validation error - invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - missing or invalid authentication
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    logger.info('Create guide request', { requestId })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Validate request body with Zod
    const body = await request.json()
    const validatedData = CreateGuideSchema.parse(body)

    const { keyword, language, searchEngine } = validatedData

    const { data, error } = await supabase
      .from('guides')
      .insert({
        user_id: user.id,
        keyword,
        language,
        search_engine: searchEngine,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    logger.info('Guide created', {
      guideId: data.id,
      keyword: validatedData.keyword,
      language: validatedData.language,
      duration: Date.now() - startTime,
      requestId,
    })

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return handleApiError(error, {
      route: '/api/guides',
      context: {},
    })
  } finally {
    logger.clearRequestId()
  }
}
