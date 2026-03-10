import React from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { codeMirrorBasicSetup } from './codeWorkspaceConfig'
import { CodeWorkspaceEditorHeader } from './CodeWorkspaceEditorHeader'
import { CodeWorkspaceStatusBar } from './CodeWorkspaceStatusBar'
import type { Extension } from '@codemirror/state'
import type { CodeFile } from '@/features/preview/types'

interface CodeWorkspaceEditorPaneProps {
    activeFile: CodeFile
    value: string
    extensions: Extension[]
    onChange: (value: string) => void
}

interface EditorStatus {
    line: number
    column: number
    lines: number
    chars: number
}

const getStatusFromContent = (content: string): Pick<EditorStatus, 'lines' | 'chars'> => ({
    lines: Math.max(1, content.split('\n').length),
    chars: content.length,
})

export const CodeWorkspaceEditorPane: React.FC<CodeWorkspaceEditorPaneProps> = ({
    activeFile,
    value,
    extensions,
    onChange,
}) => {
    const [status, setStatus] = React.useState<EditorStatus>(() => ({
        line: 1,
        column: 1,
        ...getStatusFromContent(value),
    }))

    const updateStatusFromView = React.useCallback((view: EditorView) => {
        const head = view.state.selection.main.head
        const currentLine = view.state.doc.lineAt(head)

        setStatus({
            line: currentLine.number,
            column: head - currentLine.from + 1,
            lines: view.state.doc.lines,
            chars: view.state.doc.length,
        })
    }, [])

    const statusExtension = React.useMemo<Extension>(
        () =>
            EditorView.updateListener.of((update) => {
                if (!update.docChanged && !update.selectionSet) {
                    return
                }

                const head = update.state.selection.main.head
                const currentLine = update.state.doc.lineAt(head)

                setStatus({
                    line: currentLine.number,
                    column: head - currentLine.from + 1,
                    lines: update.state.doc.lines,
                    chars: update.state.doc.length,
                })
            }),
        []
    )

    const effectiveExtensions = React.useMemo<Extension[]>(
        () => [...extensions, statusExtension],
        [extensions, statusExtension]
    )

    React.useEffect(() => {
        setStatus((previous) => ({
            ...previous,
            line: 1,
            column: 1,
            ...getStatusFromContent(value),
        }))
    }, [activeFile.path, value])

    return (
        <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-[#1e1e1e]">
            <CodeWorkspaceEditorHeader activeFile={activeFile} />

            <div className="flex-1 min-h-0">
                <CodeMirror
                    key={activeFile.path}
                    value={value}
                    height="100%"
                    className="h-full"
                    extensions={effectiveExtensions}
                    basicSetup={codeMirrorBasicSetup}
                    onChange={onChange}
                    onCreateEditor={updateStatusFromView}
                />
            </div>

            <CodeWorkspaceStatusBar
                line={status.line}
                column={status.column}
                lines={status.lines}
                chars={status.chars}
            />
        </div>
    )
}
