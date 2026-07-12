import React from 'react'
import { Text } from 'ink'

export function ParsedOutputLine({ line, isError }: { line: string; isError: boolean }) {
    const isTruncationMarker = line.startsWith('<...') && line.endsWith('...>')
    if (isTruncationMarker) {
        return (
            <Text color="yellow" dimColor>
                {line}
            </Text>
        )
    }

    if (!isError) {
        return (
            <Text color="#94a3b8" dimColor>
                {line}
            </Text>
        )
    }

    // A regex to match common file paths with line/column numbers
    // Matches:
    // /path/to/file.ts:12:34
    // C:\path\to\file.ts:12:34
    // src/components/file.tsx(12,34)
    // path/to/file.js:12
    const pathRegex =
        /((?:(?:\/[^/\0]+)+|[a-zA-Z]:\\[^\0]+|[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)+)(?:\.\w+)?(?:[:(]\d+(?:[:,]\d+)?[)]?))/g

    let lastIndex = 0
    const parts = []
    let match

    while ((match = pathRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
            parts.push(
                <Text key={`text-${lastIndex}`} color="#94a3b8" dimColor>
                    {line.substring(lastIndex, match.index)}
                </Text>
            )
        }

        parts.push(
            <Text key={`match-${match.index}`} color="redBright" bold>
                {match[1]}
            </Text>
        )
        lastIndex = match.index + match[0].length
    }

    if (lastIndex < line.length) {
        parts.push(
            <Text key={`text-${lastIndex}`} color="#94a3b8" dimColor>
                {line.substring(lastIndex)}
            </Text>
        )
    }

    return (
        <Text>
            {parts.length > 0 ? (
                parts
            ) : (
                <Text color="#94a3b8" dimColor>
                    {line}
                </Text>
            )}
        </Text>
    )
}
