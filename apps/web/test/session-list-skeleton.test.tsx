import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, afterEach } from 'bun:test'
import React from 'react'

import { SessionListSkeleton } from '../src/features/sessions/components/SessionListSkeleton'
import { SessionListView } from '../src/features/sessions/components/SessionListView'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, cleanup } = await import('@testing-library/react')

afterEach(() => {
    cleanup()
})

describe('SessionListSkeleton UI', () => {
    test('renders shimmering two-line rows, the same shape as the session rows', () => {
        const { container } = render(<SessionListSkeleton />)

        // one layout for desktop and phones, like the real rows
        const rows = container.querySelectorAll('[data-skeleton-row]')
        expect(rows.length).toBe(7)

        // Verify skeleton elements contain shimmer animation styling
        const skeletons = container.querySelectorAll('.relative.overflow-hidden')
        expect(skeletons.length).toBeGreaterThan(20)
        expect(skeletons[0].className).toContain('after:animate-[shimmer_2s_infinite]')
    })

    test('SessionListView renders SessionListSkeleton when isInitialLoading is true', () => {
        const { container } = render(
            <SessionListView
                projects={[]}
                onOpenProject={() => {}}
                isInitialLoading={true}
                errorMessage={null}
                actionError={null}
                menuOpenId={null}
                onToggleMenu={() => {}}
                onCloseMenu={() => {}}
                onToggleArchiveFromMenu={() => {}}
                onOpenRename={() => {}}
                onOpenDelete={() => {}}
                onOpenTags={() => {}}
                searchQuery=""
                onSearchChange={() => {}}
                sortOption="newest"
                onSortChange={() => {}}
                hasUnfilteredProjects={false}
            />
        )

        expect(container.querySelectorAll('[data-skeleton-row]').length).toBe(7)
    })
})
