import { homedir } from 'node:os'

import { SkillDiscoveryEngine } from '@december/shared'

import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export interface SkillItem {
    name: string
    description: string
    origin?: 'workspace' | 'global' | 'builtin' | string
    directoryPath?: string
    entryFilePath?: string
}

export interface SkillsMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    selectedIndex: number
    windowStart: number
    skills?: SkillItem[]
    // Search filter
    searchQuery?: string
    isSearching?: boolean
    // Detail view
    isDetailView?: boolean
    detailLines?: string[]
    cursorLineIndex?: number
    scrollOffset?: number
    isLoadingDetail?: boolean
    detailError?: string | null
}

export function toTildePath(p?: string): string {
    if (!p) return ''
    try {
        const home = homedir()
        return p.startsWith(home) ? '~' + p.slice(home.length) : p
    } catch {
        // Intentionally swallowed: fallback to original path
        return p
    }
}

function formatSingleLineDescription(desc: string, maxLen: number = 80): string {
    if (!desc) return ''
    const clean = desc
        .replace(/\r?\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    if (clean.length <= maxLen) return clean
    return clean.slice(0, maxLen - 1).trimEnd() + '…'
}

export function loadWorkspaceSkills(workspaceDir: string = process.cwd()): SkillItem[] {
    try {
        const engine = new SkillDiscoveryEngine({ workspaceDir })
        const discovered = engine.discoverAllSkills()
        return discovered.map((s) => ({
            name: s.name,
            description: s.metadata?.description || 'No description provided.',
            origin: s.origin,
            directoryPath: s.directoryPath,
            entryFilePath: s.entryFilePath,
        }))
    } catch {
        // Intentionally swallowed: return empty array on discovery failure
        return []
    }
}

export const SkillsMenuView = {
    getHeight(skillsCount: number, windowSize = 6, isDetailView = false): number {
        if (isDetailView) {
            return 18
        }
        const count = skillsCount || 1
        const visible = Math.min(windowSize, count)
        const hasOverflow = count > windowSize
        // Title (1) + Spacing (1) + Guide (4) + Spacing (1) + Origin (1) + Skills (visible) + Overflow (0|1) + Bottom Margin (1) + Footer (1)
        return 2 + 4 + 1 + 1 + visible + (hasOverflow ? 1 : 0) + 1 + 1
    },

    render(buffer: ScreenBuffer, props: SkillsMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const windowSize = 6

        const allSkills =
            props.skills && props.skills.length > 0 ? props.skills : loadWorkspaceSkills()

        // Filter skills by search query if present
        const query = (props.searchQuery || '').toLowerCase().trim()
        const skills = query
            ? allSkills.filter(
                  (s) =>
                      s.name.toLowerCase().includes(query) ||
                      (s.description || '').toLowerCase().includes(query)
              )
            : allSkills

        const safeIndex = Math.min(Math.max(0, props.selectedIndex), Math.max(0, skills.length - 1))
        const currentSkill = skills[safeIndex]

        // --- Detail View Rendering ---
        if (props.isDetailView && currentSkill) {
            const lines = props.detailLines || []
            const totalLines = lines.length
            const displayPath = toTildePath(currentSkill.entryFilePath)

            // Header: Skill name & entry file path on left, line coordinates on right
            drawText(buffer, currentSkill.name, {
                x,
                y,
                style: { fg: THEME.colors.brand, bold: true },
            })

            let headX = x + currentSkill.name.length
            if (displayPath) {
                const pathLabel = ` · ${displayPath}`
                drawText(buffer, pathLabel, {
                    x: headX,
                    y,
                    maxWidth: Math.max(10, width - headX - 20),
                    style: { fg: THEME.colors.dim },
                })
                headX += Math.min(pathLabel.length, width - headX - 20)
            }

            if (totalLines > 0) {
                drawText(buffer, ` (${totalLines} lines)`, {
                    x: headX,
                    y,
                    style: { fg: THEME.colors.dim },
                })
            }

            const coordLabel = `line ${(props.cursorLineIndex ?? 0) + 1}:${totalLines}`
            const coordX = Math.max(x + 40, width - coordLabel.length - 4)
            drawText(buffer, coordLabel, {
                x: coordX,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })
            y += 2

            const footerY = (props.y ?? 0) + (props.height ?? buffer.height) - 1
            const visibleLineCount = Math.max(1, footerY - y - 1)
            const gutterWidth = Math.max(3, String(totalLines).length)
            const scrollOffset = props.scrollOffset ?? 0
            const cursorLineIndex = props.cursorLineIndex ?? 0

            if (props.isLoadingDetail) {
                drawText(buffer, 'Loading documentation...', {
                    x,
                    y,
                    style: { fg: THEME.colors.dim },
                })
            } else if (props.detailError) {
                drawText(buffer, `Error: ${props.detailError}`, {
                    x,
                    y,
                    style: { fg: THEME.colors.error },
                })
            } else if (totalLines === 0) {
                drawText(buffer, '(Empty documentation)', {
                    x,
                    y,
                    style: { fg: THEME.colors.dim },
                })
            } else {
                const visibleLines = lines.slice(scrollOffset, scrollOffset + visibleLineCount)

                for (let i = 0; i < visibleLines.length; i++) {
                    const absIdx = scrollOffset + i
                    const isCursor = absIdx === cursorLineIndex
                    const lineNum = absIdx + 1
                    const lineText = visibleLines[i] || ''
                    const rowY = y + i
                    const rowBg = isCursor ? THEME.colors.codespanBg : undefined

                    // Cursor row background
                    if (isCursor) {
                        const rowWidth = Math.max(10, width - x - 2)
                        for (let c = 0; c < rowWidth; c++) {
                            buffer.setChar(x + c, rowY, ' ', { bg: rowBg })
                        }
                    }

                    // Selector
                    const selector = isCursor ? `${THEME.glyphs.selector} ` : '  '
                    drawText(buffer, selector, {
                        x,
                        y: rowY,
                        style: { fg: THEME.colors.brand, bg: rowBg, bold: isCursor },
                    })

                    // Line number in gutter
                    const paddedNum = String(lineNum).padStart(gutterWidth, ' ')
                    drawText(buffer, `${paddedNum} `, {
                        x: x + 2,
                        y: rowY,
                        style: {
                            fg: isCursor ? THEME.colors.brand : THEME.colors.dim,
                            bg: rowBg,
                            bold: isCursor,
                        },
                    })

                    // Line text
                    drawText(buffer, lineText || ' ', {
                        x: x + 2 + gutterWidth + 1,
                        y: rowY,
                        maxWidth: Math.max(10, width - x - gutterWidth - 5),
                        style: { fg: THEME.colors.text, bg: rowBg },
                    })
                }
            }

            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: [
                    { key: '↑/↓', label: 'scroll' },
                    { key: 'space', label: 'use' },
                    { key: 'esc', label: 'back' },
                ],
            })
            return
        }

        // --- List View Rendering ---
        const isCompact = (props.height ?? 24) < 14

        // Counts
        const workspaceCount = allSkills.filter((s) => s.origin === 'workspace').length
        const globalCount = allSkills.filter(
            (s) => s.origin === 'global' || s.origin === 'global-plugin'
        ).length

        // Title
        const headerText = isCompact
            ? `Skills (${allSkills.length})`
            : `Skills (${allSkills.length}) · ${workspaceCount} workspace · ${globalCount} global`

        drawText(buffer, headerText, {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 2

        if (!isCompact) {
            // Skill creation guide
            drawText(buffer, 'Create new skills', {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
            y += 1
            drawText(buffer, '  workspace: .agents/skills/{skill_name}/SKILL.md', {
                x,
                y,
                style: { fg: THEME.colors.dim },
            })
            y += 1
            drawText(
                buffer,
                '  global:    ~/.gemini/antigravity-cli/skills/{skill_name}/SKILL.md',
                {
                    x,
                    y,
                    style: { fg: THEME.colors.dim },
                }
            )
            y += 1
            drawText(buffer, '  shared:    ~/.gemini/skills/{skill_name}/SKILL.md', {
                x,
                y,
                style: { fg: THEME.colors.dim },
            })
            y += 2

            // Search filter bar
            if (props.isSearching) {
                drawText(buffer, 'Search: ', {
                    x,
                    y,
                    style: { fg: THEME.colors.brand, bold: true },
                })
                drawText(buffer, `${props.searchQuery || ''}█`, {
                    x: x + 8,
                    y,
                    style: { fg: THEME.colors.text },
                })
                y += 1
            } else if (props.searchQuery) {
                drawText(buffer, 'Filter: ', {
                    x,
                    y,
                    style: { fg: THEME.colors.muted },
                })
                drawText(buffer, props.searchQuery, {
                    x: x + 8,
                    y,
                    style: { fg: THEME.colors.brand, bold: true },
                })
                const matchBadge = ` (${skills.length} match${skills.length === 1 ? '' : 'es'})`
                drawText(buffer, matchBadge, {
                    x: x + 8 + props.searchQuery.length,
                    y,
                    style: { fg: THEME.colors.dim },
                })
                y += 1
            }

            // Dynamic origin line for selected skill
            if (currentSkill) {
                const originLabel =
                    currentSkill.origin === 'workspace'
                        ? 'Workspace skills'
                        : currentSkill.origin === 'builtin'
                          ? 'Builtin skills'
                          : 'Global skills'
                const originPath = toTildePath(
                    currentSkill.directoryPath || currentSkill.entryFilePath
                )
                drawText(buffer, `${originLabel} · From ${originPath}`, {
                    x,
                    y,
                    maxWidth: Math.max(10, width - x - 2),
                    style: { fg: THEME.colors.muted },
                })
                y += 1
            }
        }

        if (skills.length === 0) {
            const emptyMessage = props.searchQuery
                ? 'No skills matched your search query.'
                : 'No skills discovered in workspace.'
            drawText(buffer, emptyMessage, {
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
                const isSelected = absIdx === safeIndex
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
                const formattedDesc = formatSingleLineDescription(
                    item.description,
                    Math.max(10, width - descX - 2)
                )
                drawText(buffer, formattedDesc, {
                    x: descX,
                    y: rowY,
                    maxWidth: Math.max(10, width - descX - 2),
                    style: { fg: isSelected ? THEME.colors.text : THEME.colors.muted },
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
        const footerY = (props.y ?? 0) + (props.height ?? buffer.height) - 1
        const footerItems = props.isSearching
            ? [
                  { key: 'esc', label: 'cancel' },
                  { key: 'enter', label: 'confirm' },
              ]
            : props.searchQuery
              ? [
                    { key: '↑/↓', label: 'navigate' },
                    { key: 'enter', label: 'view' },
                    { key: 'space', label: 'use' },
                    { key: 'esc', label: 'clear filter' },
                ]
              : [
                    { key: '↑/↓', label: 'navigate' },
                    { key: 'enter', label: 'view' },
                    { key: '/', label: 'search' },
                    { key: 'space', label: 'use' },
                    { key: 'esc', label: 'close' },
                ]

        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: footerItems,
        })
    },
}
