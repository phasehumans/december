import React from 'react'

import { ErrorScreen } from './ErrorScreen'

import { MobileTopBar } from '@/features/navigation/components/MobileTopBar'
import { listActionButtonClass } from '@/features/sessions/components/ListParts'

/** inside the app: phones keep the top bar with the menu above the page */
export const InAppPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex h-full min-h-0 flex-col bg-[#141414]">
        <MobileTopBar />
        <div className="flex-1 min-h-0">{children}</div>
    </div>
)

/** P1: a URL the app does not know (C1-b: one grey line under the title) */
export const NotFoundPage: React.FC<{ onGoHome: () => void }> = ({ onGoHome }) => (
    <ErrorScreen art="notFound" title="Page not found" line="Check the link, or go home.">
        <button type="button" onClick={onGoHome} className={listActionButtonClass}>
            Go home
        </button>
    </ErrorScreen>
)

/**
 * P2: a session link that is deleted, wrong, or another person's. The page is the same in
 * each case, so it does not tell which session ids exist. The URL stays as it is (R1-a).
 */
export const SessionNotFoundPage: React.FC<{ onGoToSessions: () => void }> = ({
    onGoToSessions,
}) => (
    <ErrorScreen art="sessionNotFound" title="Session not found">
        <button type="button" onClick={onGoToSessions} className={listActionButtonClass}>
            Go to sessions
        </button>
    </ErrorScreen>
)
