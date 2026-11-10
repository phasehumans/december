import { THEME } from '../../theme'
import {
    formatBillingLabel,
    formatModelDisplayName,
    getCwd,
    getGitBranch,
} from '../../utils/header-format'
import { drawText } from '../ui'

import type { ReleaseAnnouncement } from '../../constants/announcements'
import type { ScreenBuffer } from '../buffer'
import type { FormattedLine } from './markdown'

export interface HeaderViewProps {
    x?: number
    y?: number
    width: number
    cliVersion?: string
    latestVersion?: string
    userEmail?: string
    activeModel?: string
    modelLabel?: string
    authMethod?: string
    selectedProvider?: string
    isAuthenticated?: boolean
    branch?: string
    cwd?: string
    announcement?: ReleaseAnnouncement | null
}

let lastHeaderKey = ''
let lastHeaderLines: FormattedLine[] = []

export const HeaderView = {
    toLines(props: HeaderViewProps, _maxWidth?: number): FormattedLine[] {
        const key = `${props.width}|${props.x}|${props.cliVersion}|${props.latestVersion}|${props.userEmail}|${props.activeModel}|${props.modelLabel}|${props.authMethod}|${props.selectedProvider}|${props.isAuthenticated}|${props.branch}|${props.cwd}|${props.announcement?.version}`
        if (key === lastHeaderKey && lastHeaderLines.length > 0) {
            return lastHeaderLines
        }

        const lines: FormattedLine[] = []
        const pad = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        const prefix = ' '.repeat(pad)

        // Top padding
        lines.push([{ text: '', style: {} }])

        // 1. Line 1: ✱ December v0.4.15
        const versionStr = props.cliVersion ? ` v${props.cliVersion.replace(/^v/, '')}` : ''
        lines.push([
            { text: `${prefix}✱ `, style: { fg: THEME.colors.brand, bold: true } },
            { text: 'December', style: { fg: THEME.colors.text, bold: true } },
            { text: versionStr, style: { fg: THEME.colors.subtle } },
        ])

        // 2. Line 2: User email (if present)
        if (props.userEmail) {
            lines.push([
                { text: `${prefix}${props.userEmail}`, style: { fg: THEME.colors.subtle } },
            ])
        }

        // 3. Line 3: Model and billing status line
        let modelStatusLine: string
        if (props.isAuthenticated === false) {
            modelStatusLine = 'Not connected · Run /login'
        } else {
            const modelName = props.modelLabel || formatModelDisplayName(props.activeModel)
            const billingLabel = formatBillingLabel(
                props.authMethod,
                props.selectedProvider,
                props.activeModel,
                props.isAuthenticated ?? true
            )
            if (modelName && billingLabel) {
                modelStatusLine = `${modelName} · ${billingLabel}`
            } else if (modelName) {
                modelStatusLine = modelName
            } else {
                modelStatusLine = billingLabel || 'API'
            }
        }
        lines.push([{ text: `${prefix}${modelStatusLine}`, style: { fg: THEME.colors.subtle } }])

        // 4. Line 4: CWD and Git branch: ~/code/december (main)
        const cwd = props.cwd || getCwd()
        const branch = props.branch !== undefined ? props.branch : getGitBranch()
        const locationLine = branch ? `${cwd} (${branch})` : cwd
        lines.push([{ text: `${prefix}${locationLine}`, style: { fg: THEME.colors.subtle } }])

        // 5. Line 5: Latest update notification OR Release Announcement banner
        if (props.latestVersion) {
            lines.push([{ text: '', style: {} }])
            const currentV = props.cliVersion ? props.cliVersion.replace(/^v/, '') : '0.1.0'
            const nextV = props.latestVersion.replace(/^v/, '')
            lines.push([
                { text: `${prefix}▎ `, style: { fg: THEME.colors.brand, bold: true } },
                {
                    text: `A new version is available: v${currentV} → v${nextV}`,
                    style: { fg: THEME.colors.text, bold: true },
                },
            ])
            lines.push([
                { text: `${prefix}▎ `, style: { fg: THEME.colors.brand, bold: true } },
                {
                    text: 'Run /update to upgrade · Changelog: trydecember.com/docs/changelog',
                    style: { fg: THEME.colors.muted },
                },
            ])
        } else if (props.announcement) {
            lines.push([{ text: '', style: {} }])
            const title = props.announcement.title || `What's New in v${props.announcement.version}`
            lines.push([
                { text: `${prefix}▎ `, style: { fg: THEME.colors.brand, bold: true } },
                { text: title, style: { fg: THEME.colors.text, bold: true } },
            ])

            const bullets = (props.announcement.bullets || []).slice(0, 2)
            for (const bullet of bullets) {
                lines.push([
                    { text: `${prefix}▎ `, style: { fg: THEME.colors.brand, bold: true } },
                    { text: bullet, style: { fg: THEME.colors.muted } },
                ])
            }

            if (props.announcement.url) {
                lines.push([
                    { text: `${prefix}▎ `, style: { fg: THEME.colors.brand, bold: true } },
                    { text: 'Check out detailed changelog on ', style: { fg: THEME.colors.muted } },
                    { text: props.announcement.url, style: { fg: THEME.colors.brand } },
                ])
            }
        }

        // Trailing blank line for separation from first user message
        lines.push([{ text: '', style: {} }])

        lastHeaderKey = key
        lastHeaderLines = lines

        return lines
    },

    getHeight(props?: HeaderViewProps): number {
        let lines = 4 // Brand, Model status, CWD/branch, blank line
        if (props?.userEmail) {
            lines += 1
        }
        if (props?.latestVersion) {
            lines += 3 // blank line + new version + action
        } else if (props?.announcement) {
            const bulletsCount = Math.min(2, props.announcement.bullets?.length || 0)
            const urlLine = props.announcement.url ? 1 : 0
            lines += 1 + 1 + bulletsCount + urlLine // blank line + title + bullets + url
        }
        return lines + 1 // +1 for top padding
    },

    render(buffer: ScreenBuffer, props: HeaderViewProps): number {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = (props.y ?? 0) + 1 // Top padding of 1
        const maxWidth = Math.max(10, props.width - x - 2)

        const versionStr = props.cliVersion ? ` v${props.cliVersion.replace(/^v/, '')}` : ''

        // 1. Line 1: ✱ December v0.4.15
        drawText(buffer, '✱ ', {
            x,
            y,
            style: { fg: THEME.colors.brand, bold: true },
        })
        drawText(buffer, 'December', {
            x: x + 2,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        if (versionStr) {
            drawText(buffer, versionStr, {
                x: x + 10,
                y,
                style: { fg: THEME.colors.subtle },
            })
        }
        y += 1

        // 2. Line 2: User email (if present)
        if (props.userEmail) {
            drawText(buffer, props.userEmail, {
                x,
                y,
                maxWidth,
                style: { fg: THEME.colors.subtle },
            })
            y += 1
        }

        // 3. Line 3: Model and billing status line
        let modelStatusLine: string
        if (props.isAuthenticated === false) {
            modelStatusLine = 'Not connected · Run /login'
        } else {
            const modelName = props.modelLabel || formatModelDisplayName(props.activeModel)
            const billingLabel = formatBillingLabel(
                props.authMethod,
                props.selectedProvider,
                props.activeModel,
                props.isAuthenticated ?? true
            )
            if (modelName && billingLabel) {
                modelStatusLine = `${modelName} · ${billingLabel}`
            } else if (modelName) {
                modelStatusLine = modelName
            } else {
                modelStatusLine = billingLabel || 'API'
            }
        }

        drawText(buffer, modelStatusLine, {
            x,
            y,
            maxWidth,
            style: { fg: THEME.colors.subtle },
        })
        y += 1

        // 4. Line 4: CWD and Git branch: ~/code/december (main)
        const cwd = props.cwd || getCwd()
        const branch = props.branch !== undefined ? props.branch : getGitBranch()
        const locationLine = branch ? `${cwd} (${branch})` : cwd

        drawText(buffer, locationLine, {
            x,
            y,
            maxWidth,
            style: { fg: THEME.colors.subtle },
        })
        y += 1

        // 5. Line 5: Latest update notification OR Release Announcement banner
        if (props.latestVersion) {
            y += 1
            drawText(buffer, '▎ ', {
                x,
                y,
                style: { fg: THEME.colors.brand, bold: true },
            })
            const currentV = props.cliVersion ? props.cliVersion.replace(/^v/, '') : '0.1.0'
            const nextV = props.latestVersion.replace(/^v/, '')
            drawText(buffer, `A new version is available: v${currentV} → v${nextV}`, {
                x: x + 2,
                y,
                maxWidth: maxWidth - 2,
                style: { fg: THEME.colors.text, bold: true },
            })
            y += 1

            drawText(buffer, '▎ ', {
                x,
                y,
                style: { fg: THEME.colors.brand, bold: true },
            })
            drawText(buffer, 'Run /update to upgrade · Changelog: trydecember.com/docs/changelog', {
                x: x + 2,
                y,
                maxWidth: maxWidth - 2,
                style: { fg: THEME.colors.muted },
            })
            y += 1
        } else if (props.announcement) {
            y += 1
            const title = props.announcement.title || `What's New in v${props.announcement.version}`
            drawText(buffer, '▎ ', {
                x,
                y,
                style: { fg: THEME.colors.brand, bold: true },
            })
            drawText(buffer, title, {
                x: x + 2,
                y,
                maxWidth: maxWidth - 2,
                style: { fg: THEME.colors.text, bold: true },
            })
            y += 1

            const bullets = (props.announcement.bullets || []).slice(0, 2)
            for (const bullet of bullets) {
                drawText(buffer, '▎ ', {
                    x,
                    y,
                    style: { fg: THEME.colors.brand, bold: true },
                })
                drawText(buffer, bullet, {
                    x: x + 2,
                    y,
                    maxWidth: maxWidth - 2,
                    style: { fg: THEME.colors.muted },
                })
                y += 1
            }

            if (props.announcement.url) {
                drawText(buffer, '▎ ', {
                    x,
                    y,
                    style: { fg: THEME.colors.brand, bold: true },
                })
                drawText(buffer, 'Check out detailed changelog on ', {
                    x: x + 2,
                    y,
                    style: { fg: THEME.colors.muted },
                })
                const prefixLen = 'Check out detailed changelog on '.length
                drawText(buffer, props.announcement.url, {
                    x: x + 2 + prefixLen,
                    y,
                    maxWidth: Math.max(10, maxWidth - 2 - prefixLen),
                    style: { fg: THEME.colors.brand },
                })
                y += 1
            }
        }

        // Return total height rendered
        return y - (props.y ?? 0) + 1 // +1 for trailing blank line
    },
}
