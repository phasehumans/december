import React from 'react'

import { copyText, getErrorReport } from '../lib/errorReport'

import { ErrorScreen, errorGhostButtonClass } from './ErrorScreen'

import { listActionButtonClass } from '@/features/sessions/components/ListParts'

const CrashScreen: React.FC<{ report: string }> = ({ report }) => {
    const [copied, setCopied] = React.useState(false)
    const handleCopy = async () => {
        if (await copyText(report)) setCopied(true)
    }
    return (
        <div className="fixed inset-0 z-[200] bg-[#141414] font-sans">
            <ErrorScreen art="crash" title="Something went wrong">
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className={listActionButtonClass}
                >
                    Reload
                </button>
                <button
                    type="button"
                    onClick={() => window.location.assign('/')}
                    className={listActionButtonClass}
                >
                    Go home
                </button>
                <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className={errorGhostButtonClass}
                >
                    {copied ? 'Copied' : 'Copy error'}
                </button>
            </ErrorScreen>
        </div>
    )
}

interface AppErrorBoundaryState {
    report: string | null
}

/**
 * P3: the whole app crashed while drawing. It shows full screen with no sidebar, because the
 * sidebar may be what broke. Reload and Go home load the page again from the start.
 */
class AppErrorBoundaryClass extends React.Component<
    { children: React.ReactNode },
    AppErrorBoundaryState
> {
    // two copies of the React types are installed (see AdminPage SectionBoundary); these
    // say what the class has at runtime
    declare readonly props: Readonly<{ children: React.ReactNode }>
    declare setState: (state: AppErrorBoundaryState) => void
    state: AppErrorBoundaryState = { report: null }

    static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
        return { report: getErrorReport(error) }
    }

    componentDidCatch(error: unknown, info: React.ErrorInfo) {
        console.error('[app] crashed while drawing:', error, info.componentStack)
        this.setState({ report: getErrorReport(error, info.componentStack) })
    }

    render() {
        if (this.state.report !== null) return <CrashScreen report={this.state.report} />
        return this.props.children
    }
}

export const AppErrorBoundary = AppErrorBoundaryClass as unknown as React.FC<{
    children: React.ReactNode
}>
