import { Box, Text } from 'ink'
import React from 'react'

export function ToolArgumentsDisplay({ toolName, inputObj }: { toolName: string; inputObj: any }) {
    if (!inputObj || typeof inputObj !== 'object') return null

    // For file replacement tools, we show a clean table of what's being edited
    if (toolName === 'multi_replace_file_content' || toolName === 'replace_file_content') {
        const path = inputObj.TargetFile || inputObj.path || ''
        const chunks =
            toolName === 'multi_replace_file_content'
                ? inputObj.ReplacementChunks
                : inputObj.TargetContent
                  ? [inputObj]
                  : []

        return (
            <Box
                flexDirection="column"
                paddingLeft={2}
                paddingTop={1}
                paddingBottom={1}
                borderStyle="single"
                borderColor="#334155"
            >
                <Box>
                    <Text color="#94a3b8">Target File: </Text>
                    <Text color="white">{path}</Text>
                </Box>
                {inputObj.Instruction && (
                    <Box>
                        <Text color="#94a3b8">Instruction: </Text>
                        <Text color="white">{inputObj.Instruction}</Text>
                    </Box>
                )}
                {chunks && chunks.length > 0 && (
                    <Box flexDirection="column" marginTop={1}>
                        <Text color="#94a3b8">Editing Chunks:</Text>
                        {chunks.map((chunk: any, i: number) => (
                            <Box key={i} flexDirection="row" gap={1} paddingLeft={2}>
                                <Text color="cyan">
                                    - Lines {chunk.StartLine || '?'} to {chunk.EndLine || '?'}
                                </Text>
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>
        )
    }

    // For general tools, avoid massive dumps
    const entries = Object.entries(inputObj).filter(([key]) => {
        if (toolName === 'run_command' || toolName === 'bash') {
            if (key === 'command' || key === 'CommandLine') return false
        }
        return true
    })
    if (entries.length === 0) return null

    return (
        <Box
            flexDirection="column"
            paddingLeft={2}
            paddingTop={1}
            paddingBottom={1}
            borderStyle="single"
            borderColor="#334155"
        >
            {entries.map(([key, val], idx) => {
                const isString = typeof val === 'string'
                const isMultiline = isString && (val as string).includes('\n')
                return (
                    <Box
                        key={idx}
                        flexDirection={isMultiline ? 'column' : 'row'}
                        gap={isMultiline ? 0 : 1}
                        marginBottom={isMultiline ? 1 : 0}
                    >
                        <Text color="#94a3b8">{key}:</Text>
                        {isMultiline ? (
                            <Box
                                paddingLeft={2}
                                borderLeftColor="#475569"
                                borderStyle="single"
                                borderTop={false}
                                borderRight={false}
                                borderBottom={false}
                            >
                                <Text color="#cbd5e1">{(val as string).trim()}</Text>
                            </Box>
                        ) : (
                            <Text color="white">{JSON.stringify(val)}</Text>
                        )}
                    </Box>
                )
            })}
        </Box>
    )
}
