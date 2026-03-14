import React from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { codeMirrorBasicSetup } from './codeWorkspaceConfig'
import type { Extension } from '@codemirror/state'
import type { CodeFile } from '@/features/preview/types'

interface CodeWorkspaceEditorPaneProps {
    activeFile: CodeFile
    value: string
    extensions: Extension[]
    onChange: (value: string) => void
}

export const CodeWorkspaceEditorPane: React.FC<CodeWorkspaceEditorPaneProps> = ({
    activeFile,
    value,
    extensions,
    onChange,
}) => {
    return (
        <div className="flex-1 min-w-0 min-h-0 bg-[#1e1e1e]">
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
    )
}
