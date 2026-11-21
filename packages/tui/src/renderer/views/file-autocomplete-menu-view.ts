import { THEME } from '../../theme'
import { drawText } from '../ui'

import { drawWindowOverflow } from './panel'

import type { ScoredFile } from '../../utils/fuzzy'
import type { ScreenBuffer } from '../buffer'

export const FILE_WINDOW_SIZE = 5

/** Shorten text in the middle with a one-cell ellipsis: "src/rend…/views" */
export function middleEllipsis(text: string, max: number): string {
    if (text.length <= max) return text
    if (max <= 1) return '…'.slice(0, max)
    const keep = max - 1
    const head = Math.ceil(keep / 2)
    const tail = keep - head
    return `${text.slice(0, head)}…${tail > 0 ? text.slice(text.length - tail) : ''}`
}

/**
 * M2.3: fit "dir/basename" into `room` cells. The folder is shortened in the middle first;
 * when the file name alone does not fit, the folder goes and the file name is cut at the end.
 * `baseLength` is how many file name characters are real (match indices past it are dropped).
 */
export function fitPath(
    file: Pick<ScoredFile, 'dir' | 'basename'>,
    room: number
): { dir: string; base: string; baseLength: number } {
    const dirStr = file.dir && file.dir !== '.' ? `${file.dir}/` : ''
    const basename = file.basename
    if (dirStr.length + basename.length <= room) {
        return { dir: dirStr, base: basename, baseLength: basename.length }
    }
    const dirRoom = room - basename.length
    if (dirStr && dirRoom >= 4) {
        // Keep the trailing slash so the file name still reads as a file name
        const shortDir = `${middleEllipsis(dirStr.slice(0, -1), dirRoom - 1)}/`
        return { dir: shortDir, base: basename, baseLength: basename.length }
    }
    if (basename.length <= room) {
        return { dir: '', base: basename, baseLength: basename.length }
    }
    const cut = Math.max(0, room - 1)
    return { dir: '', base: `${basename.slice(0, cut)}…`, baseLength: cut }
}

export interface FileAutocompleteMenuViewProps {
    x?: number
    y: number
    width: number
    files: ScoredFile[]
    selectedIndex: number
    windowStart: number
    windowSize?: number
}

export const FileAutocompleteMenuView = {
    getHeight(filesCount: number, windowSize = FILE_WINDOW_SIZE): number {
        if (filesCount === 0) return 1
        const visibleCount = Math.min(filesCount, windowSize)
        const hasOverflow = filesCount > windowSize
        return visibleCount + (hasOverflow ? 1 : 0)
    },

    render(buffer: ScreenBuffer, props: FileAutocompleteMenuViewProps): void {
        const x = (props.x ?? 0) + THEME.padding.paddingLeft
        let y = props.y
        const windowSize = props.windowSize ?? FILE_WINDOW_SIZE

        const files = props.files || []
        if (files.length === 0) {
            drawText(buffer, 'No matching files found', {
                x: x + 2,
                y,
                style: { fg: THEME.colors.muted },
            })
            return
        }

        const windowStart = Math.max(
            0,
            Math.min(props.windowStart || 0, Math.max(0, files.length - windowSize))
        )
        const windowEnd = Math.min(windowStart + windowSize, files.length)
        const visible = files.slice(windowStart, windowEnd)

        // Room for the path: the row ends where the input box text ends
        const room = Math.max(8, props.width - x - 2 - (THEME.padding.paddingRight ?? 4))

        for (let i = 0; i < visible.length; i++) {
            const file = visible[i]
            const isSelected = windowStart + i === props.selectedIndex
            const rowY = y + i

            drawText(buffer, isSelected ? `${THEME.glyphs.selector} ` : '  ', {
                x,
                y: rowY,
                style: { fg: THEME.colors.brand },
            })

            const { dir, base, baseLength } = fitPath(file, room)
            let colX = x + 2
            if (dir) {
                // M2.1: the folder is muted, so the eye goes to the file name
                drawText(buffer, dir, { x: colX, y: rowY, style: { fg: THEME.colors.muted } })
                colX += dir.length
            }

            // M2.2: matched characters in brand blue, no bold, no underline.
            // On the selected row the whole file name is brand blue.
            const matchIndices = new Set(file.basenameIndices || [])
            for (let c = 0; c < base.length; c++) {
                const isMatch = c < baseLength && matchIndices.has(c)
                drawText(buffer, base[c], {
                    x: colX + c,
                    y: rowY,
                    style: { fg: isSelected || isMatch ? THEME.colors.brand : THEME.colors.text },
                })
            }
        }
        y += visible.length

        if (files.length > windowSize) {
            drawWindowOverflow(buffer, x, y, windowStart, files.length - windowEnd)
        }
    },
}
