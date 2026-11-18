import { buildLlmsFullTxt } from '../lib/llms'

import type { APIRoute } from 'astro'

export const GET: APIRoute = () =>
    new Response(buildLlmsFullTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
