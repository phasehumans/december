import { describe, it, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { OutputHeaderViewTabs } from '@/features/preview/components/OutputHeaderViewTabs'

describe('OutputHeaderViewTabs Component', () => {
    afterEach(() => {
        cleanup()
        mock.restore()
    })

    it('renders all tabs', () => {
        render(
            <OutputHeaderViewTabs
                activeTab="preview"
                setActiveTab={() => {}}
                isSidebarCollapsed={false}
                onToggleSidebar={() => {}}
            />
        )

        expect(screen.getByText('Preview')).toBeTruthy()
        expect(screen.getByText('Canvas')).toBeTruthy()
        expect(screen.getByText('Code')).toBeTruthy()
    })

    it('calls setActiveTab when a tab is clicked', async () => {
        const setActiveTab = mock()
        const user = userEvent.setup()
        render(
            <OutputHeaderViewTabs
                activeTab="preview"
                setActiveTab={setActiveTab}
                isSidebarCollapsed={false}
                onToggleSidebar={() => {}}
            />
        )

        await user.click(screen.getByText('Code'))
        expect(setActiveTab).toHaveBeenCalledWith('code')
    })

    it('calls onBack when back button is clicked (mobile)', async () => {
        const onBack = mock()
        const user = userEvent.setup()
        const { container } = render(
            <OutputHeaderViewTabs
                activeTab="preview"
                setActiveTab={() => {}}
                isSidebarCollapsed={false}
                onToggleSidebar={() => {}}
                onBack={onBack}
            />
        )

        // Find the back button which has ChevronLeft (lucide-react adds SVG inside)
        const backBtn = container.querySelector('button.md\\:hidden')
        if (backBtn) {
            await user.click(backBtn)
        }
        expect(onBack).toHaveBeenCalled()
    })
})
