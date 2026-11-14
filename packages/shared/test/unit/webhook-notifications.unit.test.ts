import { describe, expect, it } from 'bun:test'

import {
    sendDiscordNotification,
    sendSlackNotification,
    sendTaskNotification,
    type TaskNotificationPayload,
} from '../../src/utils/webhook-notifications'

describe('Webhook Notifications - Unit Tests', () => {
    const basePayload: TaskNotificationPayload = {
        taskType: 'github_issue_fix',
        status: 'COMPLETED',
        repoFullName: 'phasehumans/december',
        issueNumber: 568,
        issueTitle: 'Automated github bot and action',
        prNumber: 789,
        prUrl: 'https://github.com/phasehumans/december/pull/789',
        summary: 'Fixed issue by automating bot workflows',
    }

    describe('sendSlackNotification', () => {
        it('formats and posts Slack payload to webhook URL', async () => {
            const originalFetch = globalThis.fetch
            let capturedUrl = ''
            let capturedBody: any = null

            globalThis.fetch = (async (url: string | URL | Request, options?: any) => {
                capturedUrl = url.toString()
                capturedBody = JSON.parse(options.body)
                return new Response('ok', { status: 200 })
            }) as any

            try {
                const res = await sendSlackNotification(
                    'https://hooks.slack.com/services/T00/B00/X00',
                    basePayload
                )
                expect(res).toBe(true)
                expect(capturedUrl).toBe('https://hooks.slack.com/services/T00/B00/X00')
                expect(capturedBody.text).toContain('COMPLETED')
                expect(capturedBody.text).toContain('phasehumans/december #568')
                expect(capturedBody.blocks[0].text.text).toContain(
                    'https://github.com/phasehumans/december/pull/789'
                )
            } finally {
                globalThis.fetch = originalFetch
            }
        })

        it('returns false gracefully when Slack request fails', async () => {
            const originalFetch = globalThis.fetch
            globalThis.fetch = (async () => {
                return new Response('invalid_token', { status: 403 })
            }) as any

            try {
                const res = await sendSlackNotification(
                    'https://hooks.slack.com/services/invalid',
                    basePayload
                )
                expect(res).toBe(false)
            } finally {
                globalThis.fetch = originalFetch
            }
        })
    })

    describe('sendDiscordNotification', () => {
        it('formats and posts Discord embed payload to webhook URL', async () => {
            const originalFetch = globalThis.fetch
            let capturedUrl = ''
            let capturedBody: any = null

            globalThis.fetch = (async (url: string | URL | Request, options?: any) => {
                capturedUrl = url.toString()
                capturedBody = JSON.parse(options.body)
                return new Response('ok', { status: 204 })
            }) as any

            try {
                const res = await sendDiscordNotification(
                    'https://discord.com/api/webhooks/123/abc',
                    basePayload
                )
                expect(res).toBe(true)
                expect(capturedUrl).toBe('https://discord.com/api/webhooks/123/abc')
                expect(capturedBody.embeds[0].title).toContain('Task #568')
                expect(capturedBody.embeds[0].color).toBe(0x2eb886) // green for completed
            } finally {
                globalThis.fetch = originalFetch
            }
        })

        it('returns false gracefully when Discord request throws network error', async () => {
            const originalFetch = globalThis.fetch
            globalThis.fetch = (async () => {
                throw new Error('Connection refused')
            }) as any

            try {
                const res = await sendDiscordNotification(
                    'https://discord.com/api/webhooks/123/error',
                    basePayload
                )
                expect(res).toBe(false)
            } finally {
                globalThis.fetch = originalFetch
            }
        })
    })

    describe('sendTaskNotification', () => {
        it('dispatches to both Slack and Discord when URLs are provided', async () => {
            const originalFetch = globalThis.fetch
            const fetchedUrls: string[] = []

            globalThis.fetch = (async (url: string | URL | Request) => {
                fetchedUrls.push(url.toString())
                return new Response('ok', { status: 200 })
            }) as any

            try {
                const result = await sendTaskNotification({
                    ...basePayload,
                    slackWebhookUrl: 'https://hooks.slack.com/test',
                    discordWebhookUrl: 'https://discord.com/api/webhooks/test',
                })

                expect(result.slackSent).toBe(true)
                expect(result.discordSent).toBe(true)
                expect(fetchedUrls.length).toBe(2)
            } finally {
                globalThis.fetch = originalFetch
            }
        })

        it('does nothing when no webhook URLs are provided', async () => {
            const originalFetch = globalThis.fetch
            let called = false

            globalThis.fetch = (async () => {
                called = true
                return new Response('ok', { status: 200 })
            }) as any

            try {
                const result = await sendTaskNotification(basePayload)
                expect(result.slackSent).toBe(false)
                expect(result.discordSent).toBe(false)
                expect(called).toBe(false)
            } finally {
                globalThis.fetch = originalFetch
            }
        })
    })
})
