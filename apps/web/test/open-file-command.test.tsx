import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const files: Record<string, string> = {
    'src/app.ts': 'const a = 1\nconst b = 2\nexport { a, b }',
}

mock.module('../src/features/preview/api/sessionFiles', () => ({
    sessionFilesAPI: {
        getSessionFile: async (_sessionId: string, path: string) => ({
            path,
            content: files[path] ?? '',
        }),
    },
}))

const { render, screen, cleanup } = await import('@testing-library/react')
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
const { FileWorkspace } = await import('../src/features/preview/components/FileWorkspace')
const { parseOpenCommand } = await import('../src/features/home/slash/slashModel')
const {
    clearWorkspaceTabRequest,
    peekWorkspaceFilePath,
    peekWorkspaceTabRequest,
    requestWorkspaceFile,
} = await import('../src/features/preview/lib/workspaceTabRequest')

afterEach(() => {
    cleanup()
    clearWorkspaceTabRequest()
})

const renderFile = (path: string) =>
    render(
        <QueryClientProvider client={new QueryClient()}>
            <FileWorkspace sessionId="session-1" path={path} />
        </QueryClientProvider>
    )

describe('/open', () => {
    test('reads the file after the command', () => {
        expect(parseOpenCommand('/open src/app.ts')).toEqual({ path: 'src/app.ts' })
        expect(parseOpenCommand('  /open ./src/app.ts  ')).toEqual({ path: 'src/app.ts' })
        expect(parseOpenCommand('/open /src/app.ts')).toEqual({ path: 'src/app.ts' })
        expect(parseOpenCommand('/open')).toEqual({ path: '' })
        expect(parseOpenCommand('/opener x')).toBe(null)
        expect(parseOpenCommand('please /open x')).toBe(null)
    })

    test('asks the workspace for the file tab with the path', () => {
        requestWorkspaceFile('src/app.ts')
        expect(peekWorkspaceTabRequest()).toBe('file')
        expect(peekWorkspaceFilePath()).toBe('src/app.ts')
    })

    test('the file tab shows the file with line numbers', async () => {
        renderFile('src/app.ts')
        expect(await screen.findByText(/const a = 1/)).toBeTruthy()
        const gutter = screen.getByTestId('file-workspace').querySelector('pre[aria-hidden]')
        expect(gutter?.textContent).toBe('1\n2\n3')
    })

    test('a missing file says so', async () => {
        renderFile('nope.ts')
        expect(await screen.findByText('Empty or not found.')).toBeTruthy()
    })
})
