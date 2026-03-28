import type { RefObject } from 'react'
import type { Message } from '@/features/chat/types'
import type { BackendProjectVersionSummary } from '@/features/projects/api/project'

export type PreviewDevice = 'desktop' | 'mobile' | 'tablet'
export type PreviewTab = 'preview' | 'code' | 'canvas'
export type GeneratedFileStatus = 'queued' | 'building' | 'done' | 'error'
export type OutputOperation = 'build' | 'edit' | 'fix'

export interface GeneratedCode {
    html: string
    css: string
    js: string
}

export interface PreviewSelectedElement {
    tagName: string
    textContent: string
}

export interface PreviewRuntimeError {
    message: string
    stack?: string | null
}

export interface GeneratedProjectFile {
    path: string
    content: string
    status: GeneratedFileStatus
    purpose?: string
    generator?: string
}

export interface OutputScreenProps {
    onBack?: () => void
    onPromptSubmit: (
        prompt: string,
        options?: { selectedElement?: PreviewSelectedElement }
    ) => Promise<void> | void
    onRuntimeError?: (error: PreviewRuntimeError) => Promise<void> | void
    messages: Message[]
    generatedFiles?: Record<string, GeneratedProjectFile>
    activeGeneratedFilePath?: string | null
    generationPhase?: 'thinking' | 'planning' | 'building' | 'done' | null
    activeOperation?: OutputOperation | null
    isGenerating?: boolean
    showStructureOnly?: boolean
    projectName?: string | null
    versions?: BackendProjectVersionSummary[]
    activeVersionId?: string | null
    isVersionLoading?: boolean
    onSelectVersion?: (versionId: string) => void
    onDownload?: () => void
}

export interface OutputHeaderProps {
    activeTab: PreviewTab
    setActiveTab: (tab: PreviewTab) => void
    device: PreviewDevice
    setDevice: (device: PreviewDevice) => void
    isSidebarCollapsed: boolean
    onToggleSidebar: () => void
    onOpenNewTab: () => void
    onBack?: () => void
    projectName?: string | null
    versions?: BackendProjectVersionSummary[]
    activeVersionId?: string | null
    isVersionLoading?: boolean
    onSelectVersion?: (versionId: string) => void
    onDownload?: () => void
}

export interface PreviewAreaProps {
    html: string
    isGenerating: boolean
    device: PreviewDevice
    isVisualMode: boolean
    onMessage: (event: MessageEvent) => void
    iframeRef: RefObject<HTMLIFrameElement>
    fullscreen?: boolean
    showStructureOnly?: boolean
}

export interface PreviewWindowProps {
    code: string
    status: 'thinking' | 'done' | 'error'
    isSidebarCollapsed: boolean
    onToggleSidebar: () => void
    isVisualMode: boolean
    onElementSelected: (element: PreviewSelectedElement) => void
    onClearSelection: () => void
}

export type CodeFilePath = string
export type CodeFileLanguage = 'html' | 'css' | 'javascript' | 'typescript' | 'tsx'

export interface CodeWorkspaceProps {
    html: string
    generatedFiles?: Record<string, GeneratedProjectFile>
    activeFilePath?: CodeFilePath | null
    onHtmlChange?: (nextHtml: string) => void
}

export interface CodeFile {
    path: CodeFilePath
    label: string
    language: CodeFileLanguage
}

export interface CodeFileTreeFileNode {
    type: 'file'
    file: CodeFile
}

export interface CodeFileTreeFolderNode {
    type: 'folder'
    name: string
    path: string
    children: CodeFileTreeNode[]
}

export type CodeFileTreeNode = CodeFileTreeFileNode | CodeFileTreeFolderNode
