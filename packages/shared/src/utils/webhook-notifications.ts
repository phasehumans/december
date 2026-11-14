export interface TaskNotificationPayload {
    taskType: string
    status: 'COMPLETED' | 'FAILED' | 'SKIPPED'
    repoFullName: string
    issueNumber: number
    issueTitle: string
    prNumber?: number
    prUrl?: string
    summary?: string
    error?: string
    slackWebhookUrl?: string
    discordWebhookUrl?: string
}

export async function sendSlackNotification(
    url: string,
    payload: TaskNotificationPayload
): Promise<boolean> {
    try {
        const statusEmoji =
            payload.status === 'COMPLETED'
                ? ':white_check_mark:'
                : payload.status === 'SKIPPED'
                  ? ':information_source:'
                  : ':x:'

        const text = `${statusEmoji} December Task ${payload.status}: ${payload.repoFullName} #${payload.issueNumber}`

        const lines = [
            `*${statusEmoji} December Task ${payload.status}*`,
            `*Repository:* \`${payload.repoFullName}\``,
            `*Issue:* #${payload.issueNumber} (${payload.issueTitle})`,
        ]

        if (payload.prUrl) {
            lines.push(`*Pull Request:* <${payload.prUrl}|#${payload.prNumber || 'PR'}>`)
        }

        if (payload.summary) {
            lines.push(`*Summary:* ${payload.summary}`)
        }

        if (payload.error) {
            lines.push(`*Error:* ${payload.error}`)
        }

        const body = {
            text,
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: lines.join('\n'),
                    },
                },
            ],
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(5000),
        })

        return response.ok
    } catch (err: any) {
        // Intentionally swallowed: slack webhook dispatch fallback
        console.warn(`[Webhook Notifications] Failed to send Slack alert: ${err?.message || err}`)
        return false
    }
}

export async function sendDiscordNotification(
    url: string,
    payload: TaskNotificationPayload
): Promise<boolean> {
    try {
        const embedColor =
            payload.status === 'COMPLETED'
                ? 0x2eb886
                : payload.status === 'SKIPPED'
                  ? 0x439fe0
                  : 0xe01e5a

        const fields: Array<{ name: string; value: string; inline?: boolean }> = [
            { name: 'Status', value: payload.status, inline: true },
            { name: 'Repository', value: payload.repoFullName, inline: true },
        ]

        if (payload.prUrl) {
            fields.push({
                name: 'Pull Request',
                value: `[#${payload.prNumber || 'PR'}](${payload.prUrl})`,
                inline: true,
            })
        }

        if (payload.summary) {
            fields.push({
                name: 'Summary',
                value: payload.summary.slice(0, 1000),
                inline: false,
            })
        }

        if (payload.error) {
            fields.push({
                name: 'Error',
                value: payload.error.slice(0, 1000),
                inline: false,
            })
        }

        const body = {
            content: `December Task ${payload.status}: ${payload.repoFullName} #${payload.issueNumber}`,
            embeds: [
                {
                    title: `Task #${payload.issueNumber}: ${payload.issueTitle}`,
                    url:
                        payload.prUrl ||
                        `https://github.com/${payload.repoFullName}/issues/${payload.issueNumber}`,
                    color: embedColor,
                    fields,
                    footer: {
                        text: 'December Automation',
                    },
                    timestamp: new Date().toISOString(),
                },
            ],
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(5000),
        })

        return response.ok
    } catch (err: any) {
        // Intentionally swallowed: discord webhook dispatch fallback
        console.warn(`[Webhook Notifications] Failed to send Discord alert: ${err?.message || err}`)
        return false
    }
}

export async function sendTaskNotification(payload: TaskNotificationPayload): Promise<{
    slackSent: boolean
    discordSent: boolean
}> {
    let slackSent = false
    let discordSent = false

    const slackUrl = payload.slackWebhookUrl || process.env.SLACK_WEBHOOK_URL
    const discordUrl = payload.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL

    if (slackUrl) {
        slackSent = await sendSlackNotification(slackUrl, payload)
    }

    if (discordUrl) {
        discordSent = await sendDiscordNotification(discordUrl, payload)
    }

    return { slackSent, discordSent }
}
