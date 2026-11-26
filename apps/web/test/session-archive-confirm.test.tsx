import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import { WorkspaceHeaderActions } from '../src/features/preview/components/WorkspaceHeaderActions'
import { sessionAPI } from '../src/features/sessions/api/session'
import { useArchiveConfirm } from '../src/features/sessions/components/SessionArchiveModal'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, waitFor } = await import('@testing-library/react')

// an archive asks first, in every session menu; an unarchive does not
describe('archive confirmation', () => {
    afterEach(() => {
        cleanup()
        mock.restore()
    })

    const Harness: React.FC<{ onArchive: () => void }> = ({ onArchive }) => {
        const { confirmArchive, archiveModal } = useArchiveConfirm()
        return (
            <>
                <button type="button" onClick={() => confirmArchive(onArchive)}>
                    Archive row
                </button>
                {archiveModal}
            </>
        )
    }

    test('the dialog says what happens, and Archive runs the archive once', async () => {
        const onArchive = mock()
        render(<Harness onArchive={onArchive} />)

        fireEvent.click(screen.getByText('Archive row'))

        expect(await screen.findByText('Archive session')).toBeTruthy()
        expect(
            screen.getByText('It moves to Archived and loses its pin. You can unarchive it there.')
        ).toBeTruthy()
        expect(onArchive).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
        expect(onArchive).toHaveBeenCalledTimes(1)
        await waitFor(() => expect(screen.queryByText('Archive session')).toBeNull())
    })

    test('Cancel closes the dialog and archives nothing', async () => {
        const onArchive = mock()
        render(<Harness onArchive={onArchive} />)

        fireEvent.click(screen.getByText('Archive row'))
        fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

        await waitFor(() => expect(screen.queryByText('Archive session')).toBeNull())
        expect(onArchive).not.toHaveBeenCalled()
    })

    const renderHeader = (isArchived: boolean) => {
        spyOn(sessionAPI, 'getSession').mockImplementation(
            async () =>
                ({
                    id: 'sess-archive',
                    title: 'Archive me',
                    type: 'WEB',
                    isArchived,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                }) as any
        )
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <WorkspaceHeaderActions projectId="sess-archive" projectName="Archive me" />
                </MemoryRouter>
            </QueryClientProvider>
        )
    }

    const openMoreMenu = () => {
        const buttons = screen.getAllByRole('button')
        const more =
            buttons.find((button) => button.innerHTML.includes('lucide-more-horizontal')) ??
            buttons[buttons.length - 1]
        fireEvent.click(more!)
    }

    test('the open session menu asks before an archive', async () => {
        const archive = spyOn(sessionAPI, 'archiveSession').mockImplementation(
            async () => ({}) as any
        )
        renderHeader(false)

        openMoreMenu()
        fireEvent.click(await screen.findByRole('button', { name: /Archive/ }))

        expect(await screen.findByText('Archive session')).toBeTruthy()
        expect(archive).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
        await waitFor(() => expect(archive).toHaveBeenCalledWith('sess-archive'))
    })

    test('the open session menu unarchives with no question', async () => {
        const unarchive = spyOn(sessionAPI, 'unarchiveSession').mockImplementation(
            async () => ({}) as any
        )
        renderHeader(true)

        openMoreMenu()
        fireEvent.click(await screen.findByRole('button', { name: /Unarchive/ }))

        await waitFor(() => expect(unarchive).toHaveBeenCalledWith('sess-archive'))
        expect(screen.queryByText('Archive session')).toBeNull()
    })
})
