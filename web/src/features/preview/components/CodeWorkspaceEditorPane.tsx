import React from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { codeMirrorBasicSetup } from './codeWorkspaceConfig'
import { CodeWorkspaceEditorHeader } from './CodeWorkspaceEditorHeader'
import type { Extension } from '@codemirror/state'
import type { CodeFile, CodeFilePath } from '@/features/preview/types'

interface CodeWorkspaceEditorPaneProps {
    activeFile: CodeFile
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
                <CodeMirror
                    key={activeFile.path}
                    value={value}
                    height="100%"
                    className="h-full"
                    extensions={extensions}
                    basicSetup={codeMirrorBasicSetup}
                    onChange={onChange}
                />
            </div>
        </div>
    )
}
