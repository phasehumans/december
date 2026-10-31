import { SkillDiscoveryEngine } from '@december/shared'

import { THEME } from '../../theme'
import { drawDivider, drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export interface SkillItem {
    name: string
    description: string
}

export interface SkillsMenuViewProps {
    x?: number
    y: number
    width: number
    height: number
    selectedIndex: number
    windowStart: number
    skills?: SkillItem[]
}

export function loadWorkspaceSkills(workspaceDir: string = process.cwd()): SkillItem[] {
    try {
        const engine = new SkillDiscoveryEngine({ workspaceDir })
        const discovered = engine.discoverAllSkills()
        return discovered.map((s) => ({
            name: s.name,
            description: s.metadata.description || 'No description provided.',
        }))
    } catch {
        // Intentionally swallowed: return empty array on discovery failure
        return []
    }
}

export const SkillsMenuView = {
    render(buffer: ScreenBuffer, props: SkillsMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const windowSize = 8

        const skills =
            props.skills && props.skills.length > 0 ? props.skills : loadWorkspaceSkills()

        drawText(buffer, `Installed Skills (${skills.length} available)`, {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 1

        drawDivider(buffer, {
            x: props.x ?? 0,
            y,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })
        y += 1

        if (skills.length === 0) {
            drawText(buffer, 'No skills discovered in workspace.', {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
        } else {
            const windowStart = Math.max(
                0,
                Math.min(props.windowStart, Math.max(0, skills.length - windowSize))
            )
            const windowEnd = Math.min(windowStart + windowSize, skills.length)
            const visible = skills.slice(windowStart, windowEnd)

            for (let i = 0; i < visible.length; i++) {
                const item = visible[i]
                const absIdx = windowStart + i
                const isSelected = absIdx === props.selectedIndex
                const rowY = y + i

                // Selector indicator
                const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted },
                })

                // Skill Name
                drawText(buffer, item.name, {
                    x: x + 2,
                    y: rowY,
                    maxWidth: 24,
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.text,
                        bold: isSelected,
                    },
                })

                // Description
                const descX = x + 28
                drawText(buffer, item.description, {
                    x: descX,
                    y: rowY,
                    maxWidth: Math.max(10, width - descX - 2),
                    style: { fg: THEME.colors.muted },
                })
            }

            // Pagination overflow
            if (skills.length > windowSize) {
                const itemsAbove = windowStart
                const itemsBelow = skills.length - windowEnd
                let statusText = ''
                if (itemsAbove > 0 && itemsBelow > 0) {
                    statusText = `↑ ${itemsAbove} more · ↓ ${itemsBelow} more`
                } else if (itemsAbove > 0) {
                    statusText = `↑ ${itemsAbove} more`
                } else if (itemsBelow > 0) {
                    statusText = `↓ ${itemsBelow} more`
                }
                if (statusText) {
                    drawText(buffer, statusText, {
                        x: x + 2,
                        y: y + visible.length,
                        style: { fg: THEME.colors.subtle },
                    })
                }
            }
        }

        // Footer at bottom
        const footerY = props.y + props.height - 1
        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: [
                { key: '↑↓', label: 'Navigate' },
                { key: 'Esc', label: 'Close' },
            ],
        })
    },
}
