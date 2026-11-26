import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, mock, afterEach } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

// loaded after the fake DOM is in place, so React sees typing in the fields
const { render, screen, fireEvent, cleanup } = await import('@testing-library/react')
const { SessionDeleteModal } =
    await import('../src/features/sessions/components/SessionDeleteModal')
const { SessionListView } = await import('../src/features/sessions/components/SessionListView')
const { SessionRenameModal } =
    await import('../src/features/sessions/components/SessionRenameModal')
const { SessionTagsModal } = await import('../src/features/sessions/components/SessionTagsModal')
const { DEFAULT_SESSIONS_VIEW } = await import('../src/features/sessions/lib/sessionsView')

afterEach(() => {
    cleanup()
    mock.restore()
})

const saveButton = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement

// a controlled rename dialog, like the Sessions page and the sidebar give it
const RenameHarness: React.FC<{ onSubmit: () => void }> = ({ onSubmit }) => {
    const [value, setValue] = React.useState('Fix login')
    return (
        <SessionRenameModal
            isOpen
            value={value}
            initialValue="Fix login"
            isPending={false}
            onClose={() => {}}
            onChange={setValue}
            onSubmit={onSubmit}
        />
    )
}

describe('Rename dialog', () => {
    test('has a heading and a subheading, and no December logo', () => {
        render(<RenameHarness onSubmit={() => {}} />)
        expect(screen.getByText('Rename session')).toBeTruthy()
        expect(screen.getByText('Shows in the sidebar and on the Sessions page.')).toBeTruthy()
        expect(document.querySelector('svg.w-8.h-8')).toBeNull()
    })

    test('Save stays off until the name changes, then sends it', () => {
        const onSubmit = mock()
        render(<RenameHarness onSubmit={onSubmit} />)
        expect(saveButton().disabled).toBe(true)

        const input = screen.getByLabelText('Session name') as HTMLInputElement
        fireEvent.change(input, { target: { value: '  Fix login  ' } })
        expect(saveButton().disabled).toBe(true)

        fireEvent.change(input, { target: { value: 'Fix login loop' } })
        expect(saveButton().disabled).toBe(false)
        fireEvent.click(saveButton())
        expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    test('the field stops at the 100 characters the server takes', () => {
        render(<RenameHarness onSubmit={() => {}} />)
        expect((screen.getByLabelText('Session name') as HTMLInputElement).maxLength).toBe(100)
    })
})

describe('Tags dialog', () => {
    const renderTags = (tags: string[], onSave = mock()) => {
        render(
            <SessionTagsModal
                isOpen
                session={{ id: 's1', title: 'Fix login', tags }}
                isPending={false}
                onClose={() => {}}
                onSave={onSave}
            />
        )
        return onSave
    }

    test('says "Tag" with one short subheading, without the old paragraph', () => {
        renderTags(['auth'])
        expect(screen.getByText('Tag')).toBeTruthy()
        expect(
            screen.getByText('One tag per session. Filter by it on the Sessions page.')
        ).toBeTruthy()
        expect(screen.queryByText(/quick identification/)).toBeNull()
        expect(screen.getByPlaceholderText('Tag name')).toBeTruthy()
    })

    test('Save stays off until the tag changes', () => {
        const onSave = renderTags(['auth'])
        expect(saveButton().disabled).toBe(true)
        fireEvent.change(screen.getByLabelText('Tag name'), { target: { value: 'billing' } })
        fireEvent.click(saveButton())
        expect(onSave).toHaveBeenCalledWith(['billing'])
    })

    test('clearing the tag and saving removes it', () => {
        const onSave = renderTags(['auth'])
        fireEvent.click(screen.getByRole('button', { name: 'Clear tag' }))
        fireEvent.click(saveButton())
        expect(onSave).toHaveBeenCalledWith([])
    })

    test('a comma cannot be typed, because the tag filter splits on it', () => {
        renderTags([])
        const input = screen.getByLabelText('Tag name') as HTMLInputElement
        fireEvent.change(input, { target: { value: 'front,end' } })
        expect(input.value).toBe('frontend')
    })
})

describe('Delete dialog', () => {
    test('says the sandbox stops, shows no name, and deletes on the red button', () => {
        const onConfirm = mock()
        render(
            <SessionDeleteModal
                isOpen
                projectTitle="Fix login"
                isPending={false}
                onClose={() => {}}
                onConfirm={onConfirm}
            />
        )
        expect(screen.getByText('Delete session')).toBeTruthy()
        expect(screen.getByText('Its sandbox stops. You cannot undo this.')).toBeTruthy()
        expect(screen.queryByText('Fix login')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })
})

describe('Sessions page archive undo', () => {
    const rows = [
        { id: 'a', title: 'First one', createdAt: '2026-11-01', updatedAt: '2026-11-01', tags: [] },
        { id: 'c', title: 'Third one', createdAt: '2026-11-01', updatedAt: '2026-11-01', tags: [] },
    ]

    const renderList = (projects: any[], archivedUndo: any) =>
        render(
            <SessionListView
                projects={projects}
                onOpenProject={() => {}}
                isInitialLoading={false}
                errorMessage={null}
                actionError={null}
                menuOpenId={null}
                onToggleMenu={() => {}}
                onCloseMenu={() => {}}
                onToggleArchiveFromMenu={() => {}}
                archivedUndo={archivedUndo}
                onOpenRename={() => {}}
                onOpenDelete={() => {}}
                onOpenTags={() => {}}
                searchQuery=""
                onSearchChange={() => {}}
                view={DEFAULT_SESSIONS_VIEW}
                onViewChange={() => {}}
                hasUnfilteredProjects={projects.length > 0}
            />
        )

    test('"Archived · Undo" sits where the row was, and Undo calls back', () => {
        const onUndo = mock()
        renderList(rows, { index: 1, onUndo })
        const line = screen.getByRole('status')
        expect(line.textContent).toContain('Archived')
        // between the first and the third row
        const text = document.body.textContent ?? ''
        expect(text.indexOf('First one')).toBeLessThan(text.indexOf('ArchivedUndo'))
        expect(text.indexOf('ArchivedUndo')).toBeLessThan(text.indexOf('Third one'))
        fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
        expect(onUndo).toHaveBeenCalledTimes(1)
    })

    test('archiving the last row keeps the list and the undo line, not "No sessions yet"', () => {
        renderList([], { index: 0, onUndo: () => {} })
        expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy()
        expect(screen.queryByText('No sessions yet')).toBeNull()
    })
})
