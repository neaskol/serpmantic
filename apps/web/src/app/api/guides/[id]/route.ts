import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UpdateGuideSchema } from '@/lib/schemas'
import { logger } from '@/lib/logger'
import { handleApiError, generateRequestId } from '@/lib/error-handler'

/**
 * @swagger
 * /api/guides/{id}:
 *   get:
 *     summary: Get guide by ID
 *     description: Retrieve a single guide with all related SERP analysis data, pages, and semantic terms
 *     tags:
 *       - Guides
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Guide unique identifier
 *     responses:
 *       200:
 *         description: Guide retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 guide:
 *                   $ref: '#/components/schemas/Guide'
 *                 analysis:
 *                   $ref: '#/components/schemas/SerpAnalysis'
 *                 pages:
 *                   type: array
 *                   items:
 *                     type: object
 *                 terms:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Guide not found
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
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    const { id } = await params
    logger.info('Get guide request', { guideId: id, requestId })

    const supabase = await createClient()

    // Optimized: fetch guide with all related data in one query
    const { data, error } = await supabase
      .from('guides')
      .select(`
        *,
        serp_analyses (
          *,
          serp_pages (*),
          semantic_terms (*)
        )
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      throw new Error('Guide not found')
    }

    // Transform nested structure for backward compatibility
    const guide = data
    const analysis = data.serp_analyses?.[0] || null
    const pages = analysis?.serp_pages || []
    const terms = analysis?.semantic_terms || []

    logger.info('Guide retrieved', { guideId: id, requestId })

    return NextResponse.json({ guide, analysis, pages, terms })
  } catch (error) {
    const { id } = await params
    return handleApiError(error, {
      route: `/api/guides/${id}`,
      context: { guideId: id },
    })
  } finally {
    logger.clearRequestId()
  }
}

/**
 * @swagger
 * /api/guides/{id}:
 *   patch:
 *     summary: Update guide
 *     description: Update guide content, meta tags, or other properties
 *     tags:
 *       - Guides
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Guide unique identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: object
 *                 description: TipTap editor content (JSON)
 *               metaTitle:
 *                 type: string
 *                 maxLength: 60
 *               metaDescription:
 *                 type: string
 *                 maxLength: 158
 *               keyword:
 *                 type: string
 *               language:
 *                 type: string
 *                 enum: [fr, en, it, de, es]
 *     responses:
 *       200:
 *         description: Guide updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Guide'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Guide not found
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
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startTime = Date.now()
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    const { id } = await params
    logger.info('Update guide request', { guideId: id, requestId })

    const supabase = await createClient()

    // Validate request body with Zod
    const body = await request.json()
    const validatedData = UpdateGuideSchema.parse(body)

    const { data, error } = await supabase
      .from('guides')
      .update({ ...validatedData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    logger.info('Guide updated', {
      guideId: id,
      duration: Date.now() - startTime,
      requestId,
    })

    return NextResponse.json(data)
  } catch (error) {
    const { id } = await params
    return handleApiError(error, {
      route: `/api/guides/${id}`,
      context: { guideId: id },
    })
  } finally {
    logger.clearRequestId()
  }
}

/**
 * @swagger
 * /api/guides/{id}:
 *   delete:
 *     summary: Delete guide
 *     description: Permanently delete a guide and all related data (SERP analysis, pages, terms)
 *     tags:
 *       - Guides
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Guide unique identifier
 *     responses:
 *       200:
 *         description: Guide deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       404:
 *         description: Guide not found
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
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    const { id } = await params
    logger.info('Delete guide request', { guideId: id, requestId })

    const supabase = await createClient()

    const { error } = await supabase.from('guides').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    logger.info('Guide deleted', { guideId: id, requestId })

    return NextResponse.json({ success: true })
  } catch (error) {
    const { id } = await params
    return handleApiError(error, {
      route: `/api/guides/${id}`,
      context: { guideId: id },
    })
  } finally {
    logger.clearRequestId()
  }
}
