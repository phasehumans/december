import { Tool, ToolExecuteContext } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

import { withFileMutationQueue } from './file-mutation-queue'

const singleEditSchema = Type.Object({
    targetContent: Type.Optional(Type.String()),
    replacementContent: Type.Optional(Type.String()),
    oldText: Type.Optional(Type.String()),
    newText: Type.Optional(Type.String()),
})

const editSchema = Type.Object({
    path: Type.String({ description: 'Path to the file to edit (relative or absolute)' }),
    targetContent: Type.Optional(
        Type.String({ description: 'The exact block of text to replace (single edit mode)' })
    ),
    replacementContent: Type.Optional(
        Type.String({ description: 'The replacement text (single edit mode)' })
    ),
    edits: Type.Optional(
        Type.Array(singleEditSchema, {
            description:
                'One or more targeted disjoint replacements applied against the original file.',
        })
    ),
})

export type EditFileInput = Static<typeof editSchema>

export function detectLineEnding(content: string): '\r\n' | '\n' {
    const crlfIdx = content.indexOf('\r\n')
    const lfIdx = content.indexOf('\n')
    if (lfIdx === -1) return '\n'
    if (crlfIdx === -1) return '\n'
    return crlfIdx < lfIdx ? '\r\n' : '\n'
}

export function normalizeToLF(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export function restoreLineEndings(text: string, ending: '\r\n' | '\n'): string {
    return ending === '\r\n' ? text.replace(/\n/g, '\r\n') : text
}

export function normalizeForFuzzyMatch(text: string): string {
    return text
        .normalize('NFKC')
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n')
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
        .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
        .replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, ' ')
}

export function levenshteinDistance(a: string, b: string): number {
    if (a === b) return 0
    if (a.length === 0) return b.length
    if (b.length === 0) return a.length

    const v0 = new Int32Array(b.length + 1)
    const v1 = new Int32Array(b.length + 1)

    for (let i = 0; i <= b.length; i++) v0[i] = i

    for (let i = 0; i < a.length; i++) {
        v1[0] = i + 1
        for (let j = 0; j < b.length; j++) {
            const cost = a[i] === b[j] ? 0 : 1
            const v1_j = v1[j] ?? 0
            const v0_j1 = v0[j + 1] ?? 0
            const v0_j = v0[j] ?? 0
            v1[j + 1] = Math.min(v1_j + 1, v0_j1 + 1, v0_j + cost)
        }
        for (let j = 0; j <= b.length; j++) v0[j] = v1[j] ?? 0
    }
    return v1[b.length] ?? b.length
}

export function stringSimilarity(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length)
    if (maxLen === 0) return 1.0
    return 1.0 - levenshteinDistance(a, b) / maxLen
}

interface NormalizedEdit {
    target: string
    replacement: string
}

interface MatchSpan {
    startIndex: number
    endIndex: number
    method: 'exact' | 'line-trimmed' | 'block-anchor' | 'unicode-fuzzy'
}

function findMatchSpan(contentLF: string, targetLF: string): MatchSpan | null {
    // 1. Exact match
    const exactIdx = contentLF.indexOf(targetLF)
    if (exactIdx !== -1) {
        return {
            startIndex: exactIdx,
            endIndex: exactIdx + targetLF.length,
            method: 'exact',
        }
    }

    const contentLines = contentLF.split('\n')
    const targetLines = targetLF.split('\n')
    const targetLen = targetLines.length

    // Helper: compute character index from line and column
    const lineOffsets: number[] = [0]
    for (let i = 0; i < contentLines.length; i++) {
        const offset = lineOffsets[i] ?? 0
        const line = contentLines[i] ?? ''
        lineOffsets.push(offset + line.length + 1)
    }

    // 2. Line-trimmed match
    const trimmedTargetLines = targetLines.map((l) => l.trimEnd())
    for (let i = 0; i <= contentLines.length - targetLen; i++) {
        let match = true
        for (let j = 0; j < targetLen; j++) {
            const line = contentLines[i + j] ?? ''
            if (line.trimEnd() !== trimmedTargetLines[j]) {
                match = false
                break
            }
        }
        if (match) {
            const startIndex = lineOffsets[i] ?? 0
            const endLineIndex = i + targetLen - 1
            const endOffset = lineOffsets[endLineIndex] ?? 0
            const endLine = contentLines[endLineIndex] ?? ''
            const endIndex = endOffset + endLine.length
            return {
                startIndex,
                endIndex,
                method: 'line-trimmed',
            }
        }
    }

    // 3. Block-anchor match with Levenshtein distance (for blocks >= 3 lines)
    if (targetLen >= 3) {
        const firstTarget = trimmedTargetLines[0]
        const lastTarget = trimmedTargetLines[targetLen - 1]

        for (let i = 0; i <= contentLines.length - targetLen; i++) {
            const startLine = contentLines[i] ?? ''
            if (startLine.trimEnd() === firstTarget) {
                // Find candidate end anchor within reasonable range [targetLen - 2, targetLen + 2]
                for (
                    let offset = Math.max(1, targetLen - 3);
                    offset <= Math.min(contentLines.length - i - 1, targetLen + 3);
                    offset++
                ) {
                    const endLineIdx = i + offset
                    const candidateEndLine = contentLines[endLineIdx] ?? ''
                    if (candidateEndLine.trimEnd() === lastTarget) {
                        // Compare inner lines with Levenshtein similarity
                        const innerTarget = targetLines.slice(1, -1).join('\n')
                        const innerCandidate = contentLines.slice(i + 1, endLineIdx).join('\n')
                        const sim = stringSimilarity(
                            normalizeForFuzzyMatch(innerTarget),
                            normalizeForFuzzyMatch(innerCandidate)
                        )

                        // Disproportionate match guard
                        const searchLineCount = offset + 1
                        if (
                            searchLineCount <= Math.max(targetLen + 3, targetLen * 2) &&
                            sim >= 0.65
                        ) {
                            const startOffset = lineOffsets[i] ?? 0
                            const endOffset = lineOffsets[endLineIdx] ?? 0
                            return {
                                startIndex: startOffset,
                                endIndex: endOffset + candidateEndLine.length,
                                method: 'block-anchor',
                            }
                        }
                    }
                }
            }
        }
    }

    // 4. Unicode & Whitespace normalized fuzzy match
    const normContent = normalizeForFuzzyMatch(contentLF)
    const normTarget = normalizeForFuzzyMatch(targetLF)
    const fuzzyIdx = normContent.indexOf(normTarget)
    if (fuzzyIdx !== -1) {
        // Map back to line boundaries
        const beforeLines = normContent.substring(0, fuzzyIdx).split('\n').length - 1
        const targetLineCount = normTarget.split('\n').length
        const afterLine = Math.min(contentLines.length - 1, beforeLines + targetLineCount - 1)
        const startOffset = lineOffsets[beforeLines] ?? 0
        const endOffset = lineOffsets[afterLine] ?? 0
        const afterLineContent = contentLines[afterLine] ?? ''

        return {
            startIndex: startOffset,
            endIndex: endOffset + afterLineContent.length,
            method: 'unicode-fuzzy',
        }
    }

    return null
}

export const EditFileTool: Tool<EditFileInput> = {
    name: 'edit_file',
    description:
        'Edits an existing file with exact or fuzzy text replacement. Supports single replacements (targetContent -> replacementContent) or multiple disjoint replacements in a single turn via edits: [{ targetContent, replacementContent }].',
    inputSchema: editSchema,
    execute: async (input, context: ToolExecuteContext) => {
        const filePath = input.path
        return withFileMutationQueue(filePath, async () => {
            try {
                const rawContent = await context.operations.fs.readFile(filePath)
                const ending = detectLineEnding(rawContent)
                const contentLF = normalizeToLF(rawContent)

                // Normalize input into list of edits
                const normalizedEdits: NormalizedEdit[] = []
                if (Array.isArray(input.edits) && input.edits.length > 0) {
                    for (const e of input.edits) {
                        const target = e.targetContent ?? e.oldText
                        const replacement = e.replacementContent ?? e.newText
                        if (typeof target === 'string' && typeof replacement === 'string') {
                            normalizedEdits.push({
                                target: normalizeToLF(target),
                                replacement: normalizeToLF(replacement),
                            })
                        }
                    }
                } else if (
                    typeof input.targetContent === 'string' &&
                    typeof input.replacementContent === 'string'
                ) {
                    normalizedEdits.push({
                        target: normalizeToLF(input.targetContent),
                        replacement: normalizeToLF(input.replacementContent),
                    })
                }

                if (normalizedEdits.length === 0) {
                    return `Error: No valid edit specifications provided for file '${filePath}'. Provide targetContent/replacementContent or edits array.`
                }

                // Match each edit against the original file buffer
                const resolvedSpans: Array<{
                    span: MatchSpan
                    replacement: string
                    target: string
                }> = []

                for (let idx = 0; idx < normalizedEdits.length; idx++) {
                    const edit = normalizedEdits[idx]
                    if (!edit) continue
                    const { target, replacement } = edit
                    const span = findMatchSpan(contentLF, target)
                    if (!span) {
                        return `Error: targetContent not found in file '${filePath}'. Ensure line breaks and indentation match, or view the file using read_file.`
                    }
                    resolvedSpans.push({ span, replacement, target })
                }

                // Check for overlapping edits
                resolvedSpans.sort((a, b) => a.span.startIndex - b.span.startIndex)
                for (let i = 0; i < resolvedSpans.length - 1; i++) {
                    const curr = resolvedSpans[i]
                    const next = resolvedSpans[i + 1]
                    if (curr && next && curr.span.endIndex > next.span.startIndex) {
                        return `Error: Overlapping edits detected in file '${filePath}'. Merge nearby changes into a single edit.`
                    }
                }

                // Apply replacements from back to front to preserve offsets
                let newContentLF = contentLF
                for (let i = resolvedSpans.length - 1; i >= 0; i--) {
                    const item = resolvedSpans[i]
                    if (!item) continue
                    const { span, replacement } = item
                    newContentLF =
                        newContentLF.substring(0, span.startIndex) +
                        replacement +
                        newContentLF.substring(span.endIndex)
                }

                const finalContent = restoreLineEndings(newContentLF, ending)
                await context.operations.fs.writeFile(filePath, finalContent)

                const methods = resolvedSpans.map((r) => r.span.method)
                const hasFuzzy = methods.some((m) => m !== 'exact')
                const methodNotice = hasFuzzy ? ` (matched with normalized whitespace)` : ''

                if (resolvedSpans.length > 1) {
                    return `Successfully edited file: ${filePath} (${resolvedSpans.length} disjoint replacements applied)`
                }
                return `Successfully edited file${methodNotice}: ${filePath}`
            } catch (error: any) {
                return `Failed to edit file: ${error.message}`
            }
        })
    },
}
