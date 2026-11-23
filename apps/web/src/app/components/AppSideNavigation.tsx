import React, { useState, useEffect, useRef } from 'react'

import type { ViewState } from '@/app/types'

import { MobileMenuSheet } from '@/features/navigation/components/MobileMenuSheet'
import Sidebar from '@/features/navigation/components/Sidebar'

interface AppSideNavigationProps {
    showSidebar: boolean
    currentView?: ViewState
    isMobileSidebarOpen: boolean
    setIsMobileSidebarOpen: (isOpen: boolean) => void
    onNewThread: () => void
    onNavigate: (target: ViewState) => void
    onOpenProject: (projectId: string) => void
    isAuthenticated: boolean
    onOpenAuth: () => void
    onSignOut?: () => void
    onHomeClick?: () => void
    isWorkspaceScreen?: boolean
}

export const AppSideNavigation: React.FC<AppSideNavigationProps> = ({
    showSidebar,
    currentView,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    onNewThread,
    onNavigate,
    onOpenProject,
    isAuthenticated,
    onOpenAuth,
    onSignOut,
    onHomeClick,
    isWorkspaceScreen = false,
}) => {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(isWorkspaceScreen)
    const prevIsWorkspaceRef = useRef(isWorkspaceScreen)

    useEffect(() => {
        if (isWorkspaceScreen && !prevIsWorkspaceRef.current) {
            setIsSidebarCollapsed(true)
        } else if (!isWorkspaceScreen && prevIsWorkspaceRef.current) {
            setIsSidebarCollapsed(false)
        }
        prevIsWorkspaceRef.current = isWorkspaceScreen
    }, [isWorkspaceScreen])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === '.') {
                e.preventDefault()
                setIsSidebarCollapsed((prev) => !prev)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    if (!showSidebar) {
        return null
    }

    return (
        <>
            <Sidebar
                onNewThread={onNewThread}
                onSessions={() => onNavigate('sessions')}
                onProfile={() => onNavigate('profile')}
                onOpenProject={onOpenProject}
                isAuthenticated={isAuthenticated}
                onOpenAuth={onOpenAuth}
                onSignOut={onSignOut}
                onHomeClick={onHomeClick}
                onCollapse={() => setIsSidebarCollapsed(true)}
                isCollapsed={isSidebarCollapsed}
                onExpand={() => setIsSidebarCollapsed(false)}
            />

            <MobileMenuSheet
                onNewThread={onNewThread}
                onHomeClick={onHomeClick}
                onSessions={() => onNavigate('sessions')}
                onProfile={() => onNavigate('profile')}
                onOpenProject={onOpenProject}
                isAuthenticated={isAuthenticated}
                onOpenAuth={onOpenAuth}
                onSignOut={onSignOut}
            />
        </>
    )
}
