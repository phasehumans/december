import { buildLlmsTxt } from '../lib/llms'

import type { APIRoute } from 'astro'

export const GET: APIRoute = () =>
    new Response(buildLlmsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
