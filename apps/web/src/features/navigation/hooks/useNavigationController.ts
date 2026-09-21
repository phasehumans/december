import { useQueryClient } from '@tanstack/react-query'
import React from 'react'
import { useNavigate } from 'react-router-dom'

import { useAppStore } from '@/app/store'
import { getPathForView, type ViewState } from '@/app/types'
import { previewAPI } from '@/features/preview/api'
import { profileAPI } from '@/features/profile/api/profile'

export const useNavigationController = () => {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const {
        activeProjectId,
        setActiveProjectId,
        setActiveProjectName,
        setActiveProjectVersionId,
        setMessages,
        setGeneratedFiles,
        setCurrentGenerationFilePaths,
        setGenerationPhase,
        setActiveOperation,
        setProjectVersions,
        setImportState,
        setIsAuthenticated,
        setShowAuthModal,
        isAuthenticated,
    } = useAppStore()

    const clearOpenedProject = React.useCallback(() => {
        setActiveProjectId(null)
        setActiveProjectName(null)
        setActiveProjectVersionId(null)
        setProjectVersions([])
    }, [setActiveProjectId, setActiveProjectName, setActiveProjectVersionId, setProjectVersions])

    const resetGenerationFlow = React.useCallback(() => {
        setGeneratedFiles({})
        setCurrentGenerationFilePaths([])
        setGenerationPhase(null)
        setActiveOperation(null)
    }, [setGeneratedFiles, setCurrentGenerationFilePaths, setGenerationPhase, setActiveOperation])

    const requireAuthOr = React.useCallback(
        (action: () => void) => {
            if (isAuthenticated) {
                action()
            } else {
                setShowAuthModal(true)
            }
        },
        [isAuthenticated, setShowAuthModal]
    )

    const handleNewThread = React.useCallback(() => {
        if (activeProjectId) {
            void previewAPI.stopPreview(activeProjectId).catch((err) => {
                console.error('Failed to stop preview:', err)
            })
        }
        const state = useAppStore.getState()
        state.setIsGenerating(false)
        state.setMessages([])
        state.setActiveProjectId(null)
        state.setActiveProjectName(null)
        state.setActiveProjectVersionId(null)
        state.setProjectVersions([])
        state.setGeneratedFiles({})
        state.setActiveGeneratedFilePath(null)
        state.setCurrentGenerationFilePaths([])
        state.setGenerationPhase(null)
        state.setActiveOperation(null)
        state.setImportState({ status: 'idle', message: null })
        state.setPreviewSession(null)
        state.setPreviewSessionError(null)
        state.setProjectLoadError(null)
        state.setSessionLoadError(null)
        state.setIsProjectOpening(false)
        state.setIsSessionOpening(false)
        state.setIsMobileSidebarOpen(false)

        navigate('/')
    }, [activeProjectId, navigate])

    const handleHomeClick = React.useCallback(() => {
        handleNewThread()
    }, [handleNewThread])

    const handleNavigate = React.useCallback(
        (target: ViewState) => {
            if (target === 'docs') {
                navigate(getPathForView(target))
                return
            }
            requireAuthOr(() => {
                navigate(getPathForView(target))
            })
        },
        [navigate, requireAuthOr]
    )

    const handleSignOut = React.useCallback(async () => {
        const landingUrl = process.env.WEB_URL || 'https://trydecember.com'
        try {
            document.cookie =
                'december_logged_in=; Path=/; Domain=.trydecember.com; Expires=Thu, 01 Jan 1970 00:00:01 GMT;'
            document.cookie = 'december_logged_in=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;'
        } catch {
            // Intentionally swallowed: cookie clearing fallback in test/restricted environment
        }
        try {
            await profileAPI.signout()
        } catch {
            // Intentionally swallowed: Proceed with client signout and redirect even if network fails
        }
        setIsAuthenticated(false)
        queryClient.removeQueries({ queryKey: ['sessions'] })
        queryClient.removeQueries({ queryKey: ['profile'] })
        if (typeof window !== 'undefined') {
            window.location.replace(landingUrl)
        }
    }, [setIsAuthenticated, queryClient])

    const onOpenAuth = React.useCallback(() => {
        setShowAuthModal(true)
    }, [setShowAuthModal])

    return {
        handleNewThread,
        handleHomeClick,
        handleNavigate,
        handleSignOut,
        onOpenAuth,
        isAuthenticated,
        requireAuthOr,
    }
}
