import { Box } from 'ink'
import React from 'react'

import { Markdown } from '../markdown'

export function autoCloseFences(text: string): string {
    if (!text) return ''
    const fenceMatches = text.match(/```/g)
    const count = fenceMatches ? fenceMatches.length : 0
    if (count % 2 !== 0) {
        return text + '\n```'
    }
    return text
}

export function splitStreamingMarkdown(text: string): { committed: string; tail: string } {
    if (!text) return { committed: '', tail: '' }

    // Look for double newlines to find paragraph/block boundaries
    let searchIndex = text.lastIndexOf('\n\n')

    while (searchIndex !== -1) {
        const pre = text.slice(0, searchIndex)
        const fenceMatches = pre.match(/```/g)
        const fenceCount = fenceMatches ? fenceMatches.length : 0

        // If even number of code fences precede this \n\n, it is not inside an unclosed code block
        if (fenceCount % 2 === 0) {
            return {
                committed: text.slice(0, searchIndex).trim(),
                tail: text.slice(searchIndex + 2),
            }
        }

        // Otherwise this \n\n was inside a code block, search for an earlier \n\n
        searchIndex = text.lastIndexOf('\n\n', searchIndex - 1)
    }

    return { committed: '', tail: text }
}

const MemoizedCommittedMarkdown = React.memo(
    function MemoizedCommittedMarkdown({ content }: { content: string }) {
        return <Markdown>{content}</Markdown>
    },
    (prev, next) => prev.content === next.content
)

export function SmoothMarkdown({ text, isRunning }: { text: string; isRunning?: boolean }) {
    if (!text) return null

    if (!isRunning) {
        return <Markdown>{text}</Markdown>
    }

    const { committed, tail } = splitStreamingMarkdown(text)
    const sanitizedTail = autoCloseFences(tail)

    return (
        <Box flexDirection="column" gap={1}>
            {committed ? <MemoizedCommittedMarkdown content={committed} /> : null}
            {sanitizedTail && sanitizedTail.trim() !== '' ? (
                <Markdown>{sanitizedTail}</Markdown>
            ) : null}
        </Box>
    )
}
