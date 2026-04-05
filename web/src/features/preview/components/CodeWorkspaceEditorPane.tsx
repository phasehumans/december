import React from 'react'
import CodeMirror from '@uiw/react-codemirror'
import type { Extension } from '@codemirror/state'

import { codeMirrorBasicSetup } from './codeWorkspaceConfig'
import { CodeWorkspaceEditorHeader } from './CodeWorkspaceEditorHeader'

import type { CodeFile, CodeFilePath } from '@/features/preview/types'

interface CodeWorkspaceEditorPaneProps {
    activeFile: CodeFile | null
    openFiles: CodeFile[]
    onSelectOpenFile: (path: CodeFilePath) => void
    onCloseOpenFile: (path: CodeFilePath) => void
    value: string
    extensions: Extension[]
    onChange: (value: string) => void
}

export const CodeWorkspaceEditorPane: React.FC<CodeWorkspaceEditorPaneProps> = ({
    activeFile,
    openFiles,
    onSelectOpenFile,
    onCloseOpenFile,
    value,
    extensions,
    onChange,
}) => {
    return (
        <div className="flex-1 min-w-0 min-h-0 bg-[#1e1e1e] flex flex-col">
            <CodeWorkspaceEditorHeader
                activeFile={activeFile}
                openFiles={openFiles}
                onSelectFile={onSelectOpenFile}
                onCloseFile={onCloseOpenFile}
            />

            <div className="flex-1 min-h-0">
                {activeFile ? (
                    <CodeMirror
                        key={activeFile.path}
                        value={value}
                        height="100%"
                        className="h-full"
                        extensions={extensions}
                        basicSetup={codeMirrorBasicSetup}
                        onChange={onChange}
                    />
                ) : (
                    <div className="h-full flex items-center justify-center text-sm text-[#8b8b8b]">
                        Files will appear here as generation starts.
                    </div>
                )}
            </div>
        </div>
    )
}
