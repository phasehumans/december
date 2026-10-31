import { THEME } from '../../theme'
import {
    formatBillingLabel,
    formatModelDisplayName,
    getCwd,
    getGitBranch,
} from '../../utils/header-format'
import { drawText } from '../ui'

import type { ScreenBuffer } from '../buffer'

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
}

export const HeaderView = {
    getHeight(props: HeaderViewProps): number {
        let lines = 4 // Brand, Model status, CWD/branch, blank line
        if (props.userEmail) {
            lines += 1
        }
        if (props.latestVersion) {
            lines += 1
        }
        return lines + 1 // +1 for top padding
    },

    render(buffer: ScreenBuffer, props: HeaderViewProps): number {
        const x = (props.x ?? 0) + THEME.padding.paddingLeft
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

        // 5. Line 5: Optional latest update notification
        if (props.latestVersion) {
            drawText(buffer, '▎ ', {
                x,
                y,
                style: { fg: THEME.colors.brand, bold: true },
            })
            drawText(buffer, `Update available: v${props.latestVersion.replace(/^v/, '')}`, {
                x: x + 2,
                y,
                maxWidth: maxWidth - 2,
                style: { fg: THEME.colors.brand, bold: true },
            })
            y += 1
        }

        // Return total height rendered
        return y - (props.y ?? 0) + 1 // +1 for trailing blank line
    },
}
