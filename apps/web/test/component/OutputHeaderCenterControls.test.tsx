import { describe, it, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { OutputHeaderCenterControls } from '@/features/preview/components/OutputHeaderCenterControls'

describe('OutputHeaderCenterControls Component', () => {
    const defaultProps = {
        device: 'desktop' as const,
        setDevice: mock(),
        isSidebarCollapsed: false,
        onToggleSidebar: mock(),
        onOpenNewTab: mock(),
        onRefresh: mock(),
    }

    afterEach(() => {
        cleanup()
        mock.restore()
    })

    it('renders mobile Chat/Preview toggle buttons', () => {
        render(<OutputHeaderCenterControls {...defaultProps} />)

        expect(screen.getByText('Chat')).toBeTruthy()
        expect(screen.getByText('Preview')).toBeTruthy()
    })

    it('calls onToggleSidebar when clicking Chat if sidebar is collapsed', async () => {
        const onToggleSidebar = mock()
        const user = userEvent.setup()
        render(
            <OutputHeaderCenterControls
                {...defaultProps}
                isSidebarCollapsed={true}
                onToggleSidebar={onToggleSidebar}
            />
        )

        await user.click(screen.getByText('Chat'))
        expect(onToggleSidebar).toHaveBeenCalled()
    })

    it('does not call onToggleSidebar when clicking Chat if sidebar is not collapsed', async () => {
        const onToggleSidebar = mock()
        const user = userEvent.setup()
        render(
            <OutputHeaderCenterControls
                {...defaultProps}
                isSidebarCollapsed={false}
                onToggleSidebar={onToggleSidebar}
            />
        )

        await user.click(screen.getByText('Chat'))
        expect(onToggleSidebar).not.toHaveBeenCalled()
    })

    it('calls onToggleSidebar when clicking Preview if sidebar is not collapsed', async () => {
        const onToggleSidebar = mock()
        const user = userEvent.setup()
        render(
            <OutputHeaderCenterControls
                {...defaultProps}
                isSidebarCollapsed={false}
                onToggleSidebar={onToggleSidebar}
            />
        )

        await user.click(screen.getByText('Preview'))
        expect(onToggleSidebar).toHaveBeenCalled()
    })
})
