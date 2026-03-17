import type { RefObject } from 'react'

export type PreviewDevice = 'desktop' | 'mobile' | 'tablet'
export type PreviewTab = 'preview' | 'code' | 'canvas'

export interface GeneratedCode {
    html: string
    css: string
    js: string
}

export interface PreviewSelectedElement {
    tagName: string
    textContent: string
}

export interface OutputScreenProps {
    onBack?: () => void
    isGenerating?: boolean
    showStructureOnly?: boolean
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
