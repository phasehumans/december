import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { s3 } from '../../config/s3'
import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { usageService } from '../usage/usage.service'

import { cliRepository } from './cli.repository'

import type { Response } from 'express'

export const verifyWalletBalance = async (userId: string) => {
    return usageService.hasMinimumBalance({ userId })
}

export const generateHandoffUrl = async (userId: string) => {
    const objectKey = `handoffs/${userId}/${Date.now()}-handoff.tar.gz`

    const putCommand = new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: objectKey,
    })

    const uploadUrl = await getSignedUrl(s3, putCommand, { expiresIn: 3600 })

    return {
        uploadUrl,
        objectKey,
    }
}

export const proxyChatCompletions = async (userId: string, body: any, res: Response) => {
    // Force stream and include usage
    body.stream = true
    if (!body.stream_options) {
        body.stream_options = { include_usage: true }
    } else {
        body.stream_options.include_usage = true
    }

    const openRouterKey = env.OPENROUTER_API_KEY
    if (!openRouterKey) {
        throw new AppError('OpenRouter API Key not configured', 500)
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': env.WEB_URL,
            'X-Title': 'December Proxy',
        },
        body: JSON.stringify(body),
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error('[OpenRouter Error]:', errorText)
        throw new AppError(`Upstream error: ${response.statusText}`, response.status)
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const reader = response.body?.getReader()
    if (!reader) {
        throw new AppError('No body in upstream response', 500)
    }

    const decoder = new TextDecoder()
    let usage: any = null
    const model = body.model

    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            res.write(chunk)

            // Extract usage from SSE
            const lines = chunk.split('\n')
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const parsed = JSON.parse(line.substring(6))
                        if (parsed.usage) {
                            usage = parsed.usage
                        }
                    } catch (e) {
                        // ignore parse errors for partial chunks
                    }
                }
            }
        }
    } finally {
        res.end()

        // Record usage asynchronously after stream ends
        if (usage) {
            usageService
                .recordUsageEvent({
                    userId,
                    model,
                    inputTokens: usage.prompt_tokens || 0,
                    outputTokens: usage.completion_tokens || 0,
                    totalTokens: usage.total_tokens || 0,
                    externalRequestId: `proxy-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                })
                .catch((e) => console.error('[Proxy Usage Record Error]:', e))
        }
    }
}

export const completeHandoff = async (
    userId: string,
    title: string,
    messages: any[],
    objectKey: string
) => {
    // If we wanted to link objectKey, we'd alter the DB or store it in ProjectMemory.
    // For now, we will store it inside messages as a system note or create a ProjectImport.
    // Let's just create a Session.
    const session = await cliRepository.createSession({
        userId,
        title: title || 'Handoff Session',
        messages: messages || [],
    })

    return session
}

export const cliService = {
    verifyWalletBalance,
    generateHandoffUrl,
    proxyChatCompletions,
    completeHandoff,
}
