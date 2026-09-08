import { Box, Text } from 'ink'
import React from 'react'

import { THEME } from '../../theme'

export type FormattedTuiError = {
    message: string
    cause?: string
    hint?: string
}

export function parseTuiError(message: string, cause?: string, hint?: string): FormattedTuiError {
    const cleanCause = (c?: string) => c?.replace(/^Cause:\s*/i, '').trim()
    const cleanMessage = (m: string) => m.replace(/^Error:\s*/i, '').trim()
    const cleanHint = (h?: string) => h?.replace(/^Hint:\s*/i, '').trim()

    if (cause || hint) {
        return {
            message: cleanMessage(message),
            cause: cleanCause(cause),
            hint: cleanHint(hint),
        }
    }

    const clean = cleanMessage(message)

    // If message is multi-line, separate notice from cause/hint
    if (clean.includes('\n')) {
        const lines = clean
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
        const firstLine = lines[0] || ''
        const rest = cleanCause(lines.slice(1).join('\n'))

        if (firstLine.includes('Rate limit or quota exhausted')) {
            const hintMatch = firstLine.match(/Please upgrade.*$/i)
            const summary = firstLine.replace(/Please upgrade.*$/i, '').trim()
            return {
                message: summary || 'Rate limit or quota exhausted from LLM provider.',
                cause: rest,
                hint: hintMatch
                    ? hintMatch[0]
                    : 'Please upgrade your API key tier with your provider or switch to December Cloud Subscription.',
            }
        }
        if (firstLine.includes('OpenRouter credits exhausted')) {
            const hintMatch = firstLine.match(/Please add credits.*$/i)
            const summary = firstLine.replace(/Please add credits.*$/i, '').trim()
            return {
                message: summary || 'OpenRouter credits exhausted or insufficient.',
                cause: rest,
                hint: hintMatch
                    ? hintMatch[0]
                    : 'Please add credits at https://openrouter.ai/settings/credits',
            }
        }
        if (firstLine.includes('Insufficient credits in your Arcee')) {
            const hintMatch = firstLine.match(/Please add credits.*$/i)
            const summary = firstLine.replace(/Please add credits.*$/i, '').trim()
            return {
                message: summary || 'Insufficient credits in your Arcee AI account.',
                cause: rest,
                hint: hintMatch
                    ? hintMatch[0]
                    : 'Please add credits or top up your balance at https://platform.arcee.ai/api/api-keys',
            }
        }
        if (firstLine.includes('Insufficient credits in your Meta')) {
            const hintMatch = firstLine.match(/Please add credits.*$/i)
            const summary = firstLine.replace(/Please add credits.*$/i, '').trim()
            return {
                message: summary || 'Insufficient credits in your Meta account.',
                cause: rest,
                hint: hintMatch
                    ? hintMatch[0]
                    : 'Please add credits or top up your balance at https://dev.meta.ai/',
            }
        }
        if (firstLine.includes('Authentication failed or session expired')) {
            const hintMatch = firstLine.match(/Please run.*$/i)
            const summary = firstLine.replace(/Please run.*$/i, '').trim()
            return {
                message: summary || 'Authentication failed or session expired.',
                cause: rest,
                hint: hintMatch
                    ? hintMatch[0]
                    : 'Please run `/login` to sign in with your December account or configure Bring Your Own Key.',
            }
        }

        const genericHintMatch = firstLine.match(
            /Please (?:add credits|top up|check|upgrade|run|switch).*$/i
        )
        if (genericHintMatch) {
            const summary = firstLine
                .replace(/Please (?:add credits|top up|check|upgrade|run|switch).*$/i, '')
                .trim()
            return {
                message: summary || firstLine,
                cause: rest,
                hint: genericHintMatch[0],
            }
        }

        return {
            message: firstLine,
            cause: rest,
        }
    }

    return {
        message: clean,
    }
}

export type ErrorMessageProps = {
    message: string
    cause?: string
    hint?: string
    hasTopMargin?: boolean
    paddingX?: number
}

export function FormattedErrorText({
    text,
    defaultColor,
    bold,
}: {
    text: string
    defaultColor: string
    bold?: boolean
}) {
    if (!text) return null
    if (!text.includes('http://') && !text.includes('https://')) {
        return (
            <Text color={defaultColor} bold={bold}>
                {text}
            </Text>
        )
    }

    const parts = text.split(/(https?:\/\/[^\s]+)/g)
    return (
        <Text color={defaultColor} bold={bold}>
            {parts.map((part, idx) => {
                if (/^https?:\/\//.test(part)) {
                    const match = part.match(/^(.*?)([.,;!?)]*)$/)
                    const url = match ? match[1] : part
                    const trailing = match ? match[2] : ''
                    return (
                        <React.Fragment key={idx}>
                            <Text color={THEME.colors.brand}>{url}</Text>
                            {trailing}
                        </React.Fragment>
                    )
                }
                return part
            })}
        </Text>
    )
}

export function ErrorMessage({
    message,
    cause,
    hint,
    hasTopMargin = false,
    paddingX = THEME.padding.paddingX,
}: ErrorMessageProps) {
    const parsed = parseTuiError(message, cause, hint)

    return (
        <Box paddingX={paddingX} paddingY={0} flexDirection="column">
            {hasTopMargin && <Text> </Text>}
            <FormattedErrorText text={parsed.message} defaultColor={THEME.colors.error} bold />
            {parsed.hint && parsed.hint !== '' && (
                <FormattedErrorText text={parsed.hint} defaultColor={THEME.colors.muted} />
            )}
        </Box>
    )
}
