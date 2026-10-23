import { useQueryClient } from '@tanstack/react-query'
import React from 'react'
import { useNavigate } from 'react-router-dom'

import { useAppStore } from '@/app/store'
import { toProjectSlug, type ViewState } from '@/app/types'
import { mapBackendMessageToUIMessage } from '@/features/chat/utils'
import { generationAPI, getSharedSocket } from '@/features/generation/api/generation'
import { sessionAPI } from '@/features/sessions/api/session'

export const useSessionController = (
    view: ViewState,
    abortGenerationRequest: () => void,
    resetGenerationRefs: () => void,
    outputOriginViewRef: React.MutableRefObject<ViewState>
) => {
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    const {
        activeProjectId,
        activeProjectName,
        activeProjectVersionId,
        setActiveProjectId,
        setActiveProjectName,
        setProjectVersions,
        setActiveProjectVersionId,
        setProjectLoadError,
        setMessages,
        setProjectType,
        replaceGeneratedOutput,
        setGenerationPhase,
        setActiveOperation,
        setIsMobileSidebarOpen,
        setIsProjectOpening,
        isGenerating,
        setIsGenerating,
        isAuthenticated,
        setShowAuthModal,
        setImportState,
        resetGeneratedOutput,
    } = useAppStore()

    const lastAutoFixSignatureRef = React.useRef<string | null>(null)

    const requireAuthOr = React.useCallback(
        (action: () => void) => {
            if (!isAuthenticated) {
                setShowAuthModal(true)
                return
            }
            action()
        },
        [isAuthenticated, setShowAuthModal]
    )

    const hydrateProjectDetail = React.useCallback(
        (detail: any) => {
            const projectOrSession = detail.project || detail.session
            const projectId = projectOrSession?.id
            const projectName = projectOrSession?.name || projectOrSession?.title || 'Session'
            const versions = detail.versions || []
            const selectedVersionId = detail.selectedVersionId || null

            if (!projectId) {
                console.error('[Session] Invalid session or project detail structure:', detail)
                return
            }

            setActiveProjectId(projectId)
            setActiveProjectName(projectName)
            setProjectVersions(versions)
            setActiveProjectVersionId(selectedVersionId)
            setProjectLoadError(null)

            const rawMessages = detail.chatMessages || []
            const uiMessages = rawMessages.map(mapBackendMessageToUIMessage)
            const activeVersionSummary = detail.activeVersion?.summary
            if (activeVersionSummary) {
                const lastAssistantIdx = [...uiMessages]
                    .reverse()
                    .findIndex((m) => m.role === 'assistant')
                if (lastAssistantIdx !== -1) {
                    const idx = uiMessages.length - 1 - lastAssistantIdx
                    if (uiMessages[idx]) {
                        uiMessages[idx].summary = activeVersionSummary
                    }
                }
            }
            setMessages(uiMessages)

            let resolvedType: 'generated' | 'github' | 'zip' = 'generated'
            const firstMsg = uiMessages[0]
            if (firstMsg && firstMsg.role === 'user') {
                const content = firstMsg.content
                if (
                    content.startsWith('Importing GitHub repository') ||
                    content === 'Imported project files'
                ) {
                    resolvedType = 'github'
                } else if (content.startsWith('Uploading ZIP archive')) {
                    resolvedType = 'zip'
                }
            }

            if (resolvedType === 'generated') {
                const projectPrompt = (
                    detail.project?.prompt ||
                    detail.session?.description ||
                    ''
                ).toLowerCase()
                if (
                    projectPrompt.includes('imported from') ||
                    projectPrompt.startsWith('importing github repository')
                ) {
                    resolvedType = 'github'
                } else if (
                    projectPrompt.startsWith('uploading zip archive') ||
                    projectPrompt.includes('project.zip')
                ) {
                    resolvedType = 'zip'
                }
            }

            setProjectType(resolvedType)

            replaceGeneratedOutput(detail.generatedFiles || {})
            const vmStatus =
                projectOrSession?.vmStatus ||
                detail.session?.vmStatus ||
                (detail.project as any)?.vmStatus

            if (vmStatus === 'RUNNING' || vmStatus === 'PROVISIONING') {
                setIsGenerating(true)
                setGenerationPhase('building')
                setActiveOperation('build')
                void generationAPI
                    .listenToSessionStream(projectId, (event) => {
                        if (event.type === 'AgentEnd' || event.type === 'result') {
                            setIsGenerating(false)
                            setGenerationPhase('done')
                            setActiveOperation(null)
                            void queryClient.invalidateQueries({ queryKey: ['sessions'] })
                            void queryClient.invalidateQueries({ queryKey: ['session', projectId] })
                        } else if (event.type === 'AgentError') {
                            setIsGenerating(false)
                            setGenerationPhase(null)
                            setActiveOperation(null)
                            void queryClient.invalidateQueries({ queryKey: ['sessions'] })
                        }
                    })
                    .catch(() => {
                        // Intentionally swallowed: background stream listener fallback
                    })
            } else {
                setGenerationPhase(null)
                setIsGenerating(false)
                setActiveOperation(null)
            }

            lastAutoFixSignatureRef.current = null
            navigate(`/sessions/${toProjectSlug(projectName)}`, { replace: true })
        },
        [
            navigate,
            queryClient,
            replaceGeneratedOutput,
            setActiveProjectId,
            setActiveProjectName,
            setProjectVersions,
            setActiveProjectVersionId,
            setProjectLoadError,
            setMessages,
            setProjectType,
            setGenerationPhase,
            setIsGenerating,
            setActiveOperation,
        ]
    )

    React.useEffect(() => {
        if (!activeProjectId) return

        const socket = getSharedSocket()
        const handleReconnect = async () => {
            try {
                const refreshedDetail = await sessionAPI.getSessionDetail(activeProjectId)
                if (refreshedDetail) {
                    hydrateProjectDetail(refreshedDetail)
                }
            } catch {
                // Intentionally swallowed: Reconnect sync fallback
            }
        }

        socket.io.on('reconnect', handleReconnect)
        return () => {
            socket.io.off('reconnect', handleReconnect)
        }
    }, [activeProjectId, hydrateProjectDetail])

    const openProject = React.useCallback(
        async ({
            projectId,
            versionId,
            originView,
            abortActiveGeneration = false,
        }: {
            projectId: string
            versionId?: string | null
            originView?: ViewState
            abortActiveGeneration?: boolean
        }) => {
            if (abortActiveGeneration) {
                abortGenerationRequest()
                setIsGenerating(false)
                resetGenerationRefs()
            }

            if (originView) {
                outputOriginViewRef.current = originView
            }

            const startTime = Date.now()
            setIsMobileSidebarOpen(false)
            setIsProjectOpening(true)
            setProjectLoadError(null)

            try {
                const detail = await sessionAPI.getSessionDetail(projectId, versionId)
                queryClient.setQueryData(['session', projectId], detail)
                hydrateProjectDetail(detail)
            } catch (error) {
                setProjectLoadError(
                    error instanceof Error ? error.message : 'Failed to open project'
                )
            } finally {
                setIsProjectOpening(false)
            }
        },
        [
            abortGenerationRequest,
            hydrateProjectDetail,
            queryClient,
            resetGenerationRefs,
            setIsGenerating,
            outputOriginViewRef,
            setIsMobileSidebarOpen,
            setIsProjectOpening,
            setProjectLoadError,
        ]
    )

    const handleOpenProject = React.useCallback(
        (projectId: string, versionId?: string | null) => {
            requireAuthOr(() => {
                void openProject({
                    projectId,
                    versionId,
                    originView: view,
                })
            })
        },
        [openProject, view, requireAuthOr]
    )

    const handleSelectVersion = React.useCallback(
        (versionId: string) => {
            if (
                !activeProjectId ||
                !versionId ||
                versionId === activeProjectVersionId ||
                isGenerating
            ) {
                return
            }

            void openProject({
                projectId: activeProjectId,
                versionId,
                originView: outputOriginViewRef.current,
            })
        },
        [activeProjectId, activeProjectVersionId, isGenerating, openProject, outputOriginViewRef]
    )

    return {
        openProject,
        handleOpenProject,
        handleSelectVersion,
        lastAutoFixSignatureRef,
    }
}
