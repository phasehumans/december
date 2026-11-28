import React from 'react'

import { ErrorScreen } from './ErrorScreen'

import { MobileTopBar } from '@/features/navigation/components/MobileTopBar'
import { listActionButtonClass } from '@/features/sessions/components/ListParts'

/** calls render inside its own render, so a throw in it reaches the boundary above */
const RenderFn: React.FC<{ fn: () => React.ReactNode }> = ({ fn }) => <>{fn()}</>

interface PanelErrorBoundaryProps {
    /** "This page could not load", "This panel could not load" */
    title?: string
    size?: 'page' | 'panel' | 'small'
    /** when this changes (the path, for example), the part tries again on its own */
    resetKey?: unknown
    className?: string
    /** a whole page: phones keep the top bar with the menu, so the user can leave */
    mobileTopBar?: boolean
    children?: React.ReactNode
    /**
     * for markup written inline in a parent: the parent's own render is not inside this
     * boundary, so the markup is passed as a function and drawn one level down
     */
    render?: () => React.ReactNode
}

interface PanelErrorBoundaryState {
    failed: boolean
    resetKey: unknown
}

/**
 * P4: one part of the app crashed. That part shows the snapped pencil and Try again; the
 * rest of the app keeps working.
 */
class PanelErrorBoundaryClass extends React.Component<
    PanelErrorBoundaryProps,
    PanelErrorBoundaryState
> {
    // two copies of the React types are installed (see AdminPage SectionBoundary); these
    // say what the class has at runtime
    declare readonly props: Readonly<PanelErrorBoundaryProps>
    declare setState: (state: Partial<PanelErrorBoundaryState>) => void
    // getDerivedStateFromProps copies resetKey in before the first render
    state: PanelErrorBoundaryState = { failed: false, resetKey: undefined }

    static getDerivedStateFromError(): Partial<PanelErrorBoundaryState> {
        return { failed: true }
    }

    static getDerivedStateFromProps(
        props: PanelErrorBoundaryProps,
        state: PanelErrorBoundaryState
    ): Partial<PanelErrorBoundaryState> | null {
        if (props.resetKey !== state.resetKey) {
            return { failed: false, resetKey: props.resetKey }
        }
        return null
    }

    componentDidCatch(error: unknown, info: React.ErrorInfo) {
        console.error('[panel] crashed while drawing:', error, info.componentStack)
    }

    render() {
        const { title = 'This panel could not load', size = 'panel', className } = this.props
        if (this.state.failed) {
            const screen = (
                <ErrorScreen art="crash" title={title} size={size} className={className}>
                    <button
                        type="button"
                        onClick={() => this.setState({ failed: false })}
                        className={listActionButtonClass}
                    >
                        Try again
                    </button>
                </ErrorScreen>
            )
            if (!this.props.mobileTopBar) return screen
            return (
                <div className="flex h-full min-h-0 flex-col bg-[#141414]">
                    <MobileTopBar />
                    <div className="flex-1 min-h-0">{screen}</div>
                </div>
            )
        }
        if (this.props.render) return <RenderFn fn={this.props.render} />
        return this.props.children
    }
}

export const PanelErrorBoundary =
    PanelErrorBoundaryClass as unknown as React.FC<PanelErrorBoundaryProps>
