import fs from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

import { Box, Text } from 'ink'
import React from 'react'

import { type ReleaseAnnouncement } from '../constants/announcements'
import { THEME } from '../theme'
import { terminalLink } from '../utils/terminal-link'

let cachedBranch: string | null | undefined = undefined

export function clearGitBranchCache() {
    cachedBranch = undefined
}

export function getGitBranch(workspaceRoot: string = process.cwd()): string | null {
    if (cachedBranch !== undefined) {
        return cachedBranch
    }
    try {
        const gitPath = path.resolve(workspaceRoot, '.git')
        if (fs.existsSync(gitPath)) {
            const stat = fs.statSync(gitPath)
            let headPath = path.resolve(gitPath, 'HEAD')
            if (stat.isFile()) {
                const content = fs.readFileSync(gitPath, 'utf-8').trim()
                if (content.startsWith('gitdir:')) {
                    const gitDir = content.slice(7).trim()
                    headPath = path.resolve(workspaceRoot, gitDir, 'HEAD')
                }
            }

            if (fs.existsSync(headPath)) {
                const headContent = fs.readFileSync(headPath, 'utf-8').trim()
                if (headContent.startsWith('ref: refs/heads/')) {
                    cachedBranch = headContent.replace('ref: refs/heads/', '').trim()
                    return cachedBranch
                }
                if (headContent) {
                    cachedBranch = headContent.slice(0, 7)
                    return cachedBranch
                }
            }
        }
    } catch {
        // Intentionally swallowed: fallback to null if git branch cannot be resolved
    }
    cachedBranch = null
    return null
}

function getCwd(): string {
    try {
        const cwd = process.cwd()
        const home = homedir()
        return cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd
    } catch {
        // Intentionally swallowed: fallback to default home tilde path if process.cwd fails
        return '~'
    }
}

export function formatModelDisplayName(model?: string): string {
    if (!model) return ''
    const m = model.trim()
    const lower = m.toLowerCase()

    const curated: Record<string, string> = {
        'claude-3-7-sonnet': 'Claude 3.7 Sonnet',
        'claude-3.7-sonnet': 'Claude 3.7 Sonnet',
        'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
        'claude-3.5-sonnet': 'Claude 3.5 Sonnet',
        'claude-3-5-haiku': 'Claude 3.5 Haiku',
        'claude-3.5-haiku': 'Claude 3.5 Haiku',
        'claude-4-5-opus': 'Claude 4.5 Opus',
        'claude-4.5-opus': 'Claude 4.5 Opus',
        'claude-opus-5': 'Claude Opus 5',
        'claude-sonnet-4.6': 'Claude Sonnet 4.6',
        'claude-sonnet-5': 'Claude Sonnet 5',
        'gemini-2.5-flash': 'Gemini 2.5 Flash',
        'gemini-2.5-pro': 'Gemini 2.5 Pro',
        'gemini-3.7-flash': 'Gemini 3.7 Flash',
        'gemini-3.6-flash': 'Gemini 3.6 Flash',
        'gemini-3.8-flash': 'Gemini 3.8 Flash',
        'gpt-5.6-sol': 'GPT-5.6 Sol',
        'gpt-5.6-luna': 'GPT-5.6 Luna',
        'gpt-4o': 'GPT-4o',
        'gpt-4o-mini': 'GPT-4o Mini',
        o1: 'o1',
        'o1-mini': 'o1-mini',
        o3: 'o3',
        'o3-mini': 'o3-mini',
        'o4-mini': 'o4-mini',
        'december-auto': 'December Auto',
    }

    if (curated[lower]) return curated[lower]

    const parts = m.split(/[/:]/)
    const last = parts[parts.length - 1]
    return last
        .split(/[-_]/)
        .map((part) => {
            if (/^\d+(\.\d+)*$/.test(part)) return part
            if (/^(gpt|llm|ai|api|oss)$/i.test(part)) return part.toUpperCase()
            return part.charAt(0).toUpperCase() + part.slice(1)
        })
        .join(' ')
}

export function formatBillingLabel(
    authMethod?: string,
    provider?: string,
    model?: string,
    isAuthenticated: boolean = true
): string {
    if (!isAuthenticated) {
        return 'Not connected · Run /login'
    }

    const p = (provider || '').toLowerCase().trim()
    const m = (model || '').toLowerCase().trim()

    let brand = 'API'
    if (p === 'copilot' || p === 'github') {
        brand = 'Copilot'
    } else if (p === 'claude' || p === 'anthropic') {
        brand = 'Claude'
    } else if (p === 'codex' || p === 'chatgpt') {
        brand = 'ChatGPT'
    } else if (p === 'openai') {
        brand = authMethod === 'subscription' ? 'ChatGPT' : 'OpenAI'
    } else if (p === 'gemini' || p === 'google') {
        brand = 'Gemini'
    } else if (p === 'deepseek') {
        brand = 'DeepSeek'
    } else if (p === 'groq') {
        brand = 'Groq'
    } else if (p === 'mistral' || p.includes('mistral')) {
        brand = 'Mistral'
    } else if (p === 'openrouter') {
        brand = 'OpenRouter'
    } else if (p === 'ollama') {
        brand = 'Ollama'
    } else if (p) {
        brand = p.charAt(0).toUpperCase() + p.slice(1)
    } else if (
        m.includes('claude') ||
        m.includes('sonnet') ||
        m.includes('opus') ||
        m.includes('haiku')
    ) {
        brand = 'Claude'
    } else if (m.includes('gpt') || m.includes('o1') || m.includes('o3') || m.includes('o4')) {
        brand = authMethod === 'subscription' ? 'ChatGPT' : 'OpenAI'
    } else if (m.includes('gemini')) {
        brand = 'Gemini'
    } else if (m.includes('deepseek')) {
        brand = 'DeepSeek'
    }

    if (authMethod === 'december') {
        return 'December Billing'
    }

    if (authMethod === 'subscription') {
        return `${brand} Subscription`
    }

    if (authMethod === 'byok' || authMethod === 'env') {
        return brand === 'Ollama' ? 'Ollama Local' : `${brand} API`
    }

    return brand ? `${brand} API` : 'API'
}

export interface HeaderProps {
    cliVersion?: string
    latestVersion?: string
    userEmail?: string
    announcement?: ReleaseAnnouncement | null
    activeModel?: string
    modelLabel?: string
    authMethod?: 'byok' | 'december' | 'subscription' | 'env' | string
    selectedProvider?: string
    isAuthenticated?: boolean
}

export const Header = React.memo(function Header({
    cliVersion = '0.1.0',
    latestVersion,
    userEmail,
    announcement,
    activeModel,
    modelLabel,
    authMethod,
    selectedProvider,
    isAuthenticated,
}: HeaderProps) {
    const cwd = getCwd()
    const branch = getGitBranch()

    let modelStatusLine: string | null = null
    if (isAuthenticated === false) {
        modelStatusLine = 'Not connected · Run /login'
    } else if (activeModel || modelLabel) {
        const modelName = modelLabel || formatModelDisplayName(activeModel)
        const billingLabel = formatBillingLabel(
            authMethod,
            selectedProvider,
            activeModel,
            isAuthenticated ?? true
        )
        modelStatusLine = `${modelName} · ${billingLabel}`
    }

    return (
        <Box
            flexDirection="column"
            paddingLeft={THEME.padding.paddingLeft ?? THEME.padding.paddingX}
            paddingRight={THEME.padding.paddingRight ?? 4}
            paddingTop={1}
            paddingBottom={0}
        >
            <Text>
                <Text color={THEME.colors.brand}>✱ </Text>
                <Text bold color={THEME.colors.text}>
                    December
                </Text>
                <Text color={THEME.colors.subtle}> v{cliVersion.replace(/^v/, '')}</Text>
            </Text>
            {userEmail && <Text color={THEME.colors.subtle}>{userEmail}</Text>}
            {modelStatusLine && <Text color={THEME.colors.subtle}>{modelStatusLine}</Text>}
            <Box gap={1}>
                <Text color={THEME.colors.subtle}>{cwd}</Text>
                {branch && <Text color={THEME.colors.subtle}>({branch})</Text>}
            </Box>
            <Box flexDirection="column" marginTop={1}>
                <Text color={THEME.colors.muted}>
                    {'Press / for commands  ·  Use /handoff to continue in cloud ('}
                    <Text color={THEME.colors.brand}>
                        {terminalLink('trydecember.com', 'https://trydecember.com')}
                    </Text>
                    {')'}
                </Text>
                {latestVersion && (
                    <Text color={THEME.colors.muted}>
                        Run /update to install December CLI {latestVersion}
                    </Text>
                )}
            </Box>
            {announcement && (
                <Box flexDirection="column" marginTop={1}>
                    <Box>
                        <Text color={THEME.colors.brand}>▎ </Text>
                        <Text bold color={THEME.colors.text}>
                            {announcement.title || `What's New in v${announcement.version}`}
                        </Text>
                    </Box>
                    {announcement.bullets.slice(0, 3).map((bullet, idx) => (
                        <Box key={idx}>
                            <Text color={THEME.colors.brand}>▎ </Text>
                            <Text color={THEME.colors.muted}>{bullet}</Text>
                        </Box>
                    ))}
                    {announcement.url && (
                        <Box>
                            <Text color={THEME.colors.brand}>▎ </Text>
                            <Text color={THEME.colors.muted}>Check out detailed changelog on </Text>
                            <Text color={THEME.colors.brand}>
                                {terminalLink(announcement.url, announcement.url)}
                            </Text>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    )
})
