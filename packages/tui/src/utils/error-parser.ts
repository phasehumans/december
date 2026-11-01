export type FormattedTuiError = {
    message: string
    cause?: string
    hint?: string
}

export function parseTuiError(message: string, cause?: string, hint?: string): FormattedTuiError {
    const cleanCause = (c?: string) => c?.replace(/^Cause:\s*/i, '').trim()
    const cleanMessage = (m: string) => m.replace(/^Error:\s*/i, '').trim()
    const cleanHint = (h?: string) => h?.replace(/^Hint:\s*/i, '').trim()

    if (hint) {
        return {
            message: cleanMessage(message),
            cause: cleanCause(cause),
            hint: cleanHint(hint),
        }
    }

    const clean = cleanMessage(message)

    // Check for December Wallet error notice (HTTP 402 or wallet balance)
    if (
        clean.includes('Insufficient credits in December Wallet') ||
        clean.startsWith('402') ||
        clean.includes('Payment Required')
    ) {
        const lines = clean
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
        const firstLine = lines[0] || ''
        const rest = cleanCause(lines.slice(1).join('\n'))
        const hintMatch = firstLine.match(
            /Please (?:add credits|top up|check|upgrade|run|switch|configure).*$/i
        )
        const summary = hintMatch
            ? firstLine
                  .replace(
                      /Please (?:add credits|top up|check|upgrade|run|switch|configure).*$/i,
                      ''
                  )
                  .replace(/^402\s*/, '')
                  .trim()
            : firstLine.replace(/^402\s*/, '').trim() || 'Insufficient credits in December Wallet.'

        const defaultHint =
            'Please add credits at https://app.trydecember.com/settings/billing or configure Bring Your Own Key (BYOK) via /login to continue using December.'
        let hintText = hintMatch ? hintMatch[0].trim() : defaultHint
        if (!hintText.includes('/login')) {
            hintText +=
                ' or configure Bring Your Own Key (BYOK) via /login to continue using December.'
        }

        return {
            message: summary || 'Insufficient credits in December Wallet.',
            cause: rest || cleanCause(cause),
            hint: hintText,
        }
    }

    if (cause) {
        return {
            message: cleanMessage(message),
            cause: cleanCause(cause),
            hint: cleanHint(hint),
        }
    }

    // Rate limit or quota exhausted
    if (clean.includes('Rate limit or quota exhausted')) {
        const lines = clean
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
        const firstLine = lines[0] || ''
        const rest = cleanCause(lines.slice(1).join('\n'))
        const hintMatch = firstLine.match(/Please.*$/i)
        const summary = firstLine.replace(/Please.*$/i, '').trim()
        return {
            message: summary || 'Rate limit or quota exhausted from LLM provider.',
            cause: rest,
            hint: hintMatch
                ? `${hintMatch[0].trim()} You can switch models using /model.`
                : 'Please check your account limits or switch models using /model.',
        }
    }

    // OpenRouter credits exhausted
    if (clean.includes('OpenRouter credits exhausted')) {
        const lines = clean
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
        const firstLine = lines[0] || ''
        const rest = cleanCause(lines.slice(1).join('\n'))
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

    // If message is multi-line, separate notice from cause/hint
    if (clean.includes('\n')) {
        const lines = clean
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
        const firstLine = lines[0] || ''
        const rest = cleanCause(lines.slice(1).join('\n'))

        if (
            firstLine.startsWith('Unable to connect') ||
            firstLine.includes('Connection error') ||
            firstLine.includes('Connection refused') ||
            firstLine.includes('timed out') ||
            clean.includes('Endpoint:')
        ) {
            return {
                message: clean,
                cause: cleanCause(cause),
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
        if (
            firstLine.includes('Insufficient credits in your ') ||
            firstLine.includes('Insufficient balance in your ') ||
            firstLine.includes('Insufficient credits or balance ')
        ) {
            const hintMatch = firstLine.match(
                /Please (?:add credits|top up|check|upgrade|switch).*$/i
            )
            const summary = firstLine
                .replace(/Please (?:add credits|top up|check|upgrade|switch).*$/i, '')
                .trim()
            return {
                message: summary || firstLine,
                cause: rest,
                hint: hintMatch ? hintMatch[0] : undefined,
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
                    : 'Please run /login to sign in with your December account or configure Bring Your Own Key.',
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

    const cleanLower = clean.toLowerCase()
    if (
        clean === 'Connection error.' ||
        cleanLower === 'connection error' ||
        cleanLower.startsWith('connection error')
    ) {
        return {
            message: 'Unable to connect to LLM provider (Connection error).',
            cause: cleanCause(cause),
            hint: cleanHint(hint),
        }
    }
    if (clean.startsWith('Unable to connect to ') && !hint) {
        return {
            message: clean,
            cause: cleanCause(cause),
        }
    }

    return {
        message: clean,
    }
}
