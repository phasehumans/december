import { useQueryClient } from '@tanstack/react-query'
import React from 'react'
import { useLocation } from 'react-router-dom'

import { SessionDeleteModal } from '../components/SessionDeleteModal'
import { SessionRenameModal } from '../components/SessionRenameModal'
import { SessionTagsModal } from '../components/SessionTagsModal'

import { useSessionListMutations } from './useSessionListMutations'

import type { BackendSession } from '@/features/sessions/api/session'
import type { DeleteModalState, RenameModalState } from '@/features/sessions/types'

import { useAppStore } from '@/app/store'
import { getViewForPath } from '@/app/types'
import { generationAPI } from '@/features/generation/api/generation'
import { sessionAPI } from '@/features/sessions/api/session'

/** how long "Archived · Undo" stays in the list (R8-b) */
export const ARCHIVE_UNDO_MS = 5000

/** the agent needs a moment to stop. the list is read again after this */
const STOP_REFRESH_MS = 2000

export interface ArchivedUndo {
    session: BackendSession
    /** where the row was, so the undo line sits in its place */
    index: number
}

/** "Archive merged" archived these sessions; Undo brings them back */
export interface ArchivedMergedUndo {
    sessionIds: string[]
}

/** the id of the session open on screen, or null on home, lists and settings */
export const useCurrentSessionId = () => {
    const path = useLocation().pathname
    const activeProjectId = useAppStore((s) => s.activeProjectId)
    return getViewForPath(path) === 'project' ? activeProjectId : null
}

const closedRename: RenameModalState = { isOpen: false, project: null, value: '' }
const closedDelete: DeleteModalState = { isOpen: false, project: null }
const closedTags = { isOpen: false, project: null as BackendSession | null }

/**
 * row actions for session lists outside the Sessions page (sidebar Recent, phone menu sheet):
 * rename, tags and delete open the Sessions page modals, archive leaves an undo line for a few
 * seconds, and archiving or deleting the session you are in sends you home (M4-a).
 * render `modals` once next to the list.
 */
export const useSessionActions = (onLeaveCurrent: () => void) => {
    const queryClient = useQueryClient()
    const currentSessionId = useCurrentSessionId()
    const [renameModal, setRenameModal] = React.useState<RenameModalState>(closedRename)
    const [deleteModal, setDeleteModal] = React.useState<DeleteModalState>(closedDelete)
    const [tagsModal, setTagsModal] = React.useState(closedTags)
    const [undo, setUndo] = React.useState<ArchivedUndo | null>(null)
    const undoTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const [mergedUndo, setMergedUndo] = React.useState<ArchivedMergedUndo | null>(null)
    const mergedUndoTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    const {
        toggleArchiveMutation,
        togglePinMutation,
        renameMutation,
        deleteMutation,
        updateTagsMutation,
    } = useSessionListMutations({
        setActionError: (message) => {
            if (message) console.error(message)
        },
        onRenameMutate: () => setRenameModal(closedRename),
        onDeleteMutate: () => setDeleteModal(closedDelete),
    })

    React.useEffect(
        () => () => {
            if (undoTimer.current) clearTimeout(undoTimer.current)
            if (mergedUndoTimer.current) clearTimeout(mergedUndoTimer.current)
        },
        []
    )

    const leaveIfCurrent = (sessionId: string) => {
        if (sessionId === currentSessionId) onLeaveCurrent()
    }

    const clearUndo = () => {
        if (undoTimer.current) clearTimeout(undoTimer.current)
        undoTimer.current = null
        setUndo(null)
    }

    const toggleArchive = (session: BackendSession, index: number) => {
        if (session.isArchived) {
            toggleArchiveMutation.mutate({ sessionId: session.id, isArchived: false })
            return
        }
        toggleArchiveMutation.mutate({ sessionId: session.id, isArchived: true })
        if (undoTimer.current) clearTimeout(undoTimer.current)
        setUndo({ session, index })
        undoTimer.current = setTimeout(() => setUndo(null), ARCHIVE_UNDO_MS)
        leaveIfCurrent(session.id)
    }

    const undoArchive = () => {
        if (!undo) return
        toggleArchiveMutation.mutate({ sessionId: undo.session.id, isArchived: false })
        clearUndo()
    }

    const togglePin = (session: BackendSession) =>
        togglePinMutation.mutate({ sessionId: session.id, isPinned: !session.isPinned })

    const refreshLists = () => void queryClient.invalidateQueries({ queryKey: ['sessions'] })

    /** archives every merged, not running session and leaves "Archived 4 · Undo" */
    const archiveMerged = async () => {
        try {
            const { sessionIds } = await sessionAPI.archiveMergedSessions()
            refreshLists()
            if (sessionIds.length === 0) return
            if (mergedUndoTimer.current) clearTimeout(mergedUndoTimer.current)
            setMergedUndo({ sessionIds })
            mergedUndoTimer.current = setTimeout(() => setMergedUndo(null), ARCHIVE_UNDO_MS)
            if (currentSessionId && sessionIds.includes(currentSessionId)) onLeaveCurrent()
        } catch (error) {
            console.error('Failed to archive merged sessions', error)
        }
    }

    const undoArchiveMerged = async () => {
        if (!mergedUndo) return
        if (mergedUndoTimer.current) clearTimeout(mergedUndoTimer.current)
        mergedUndoTimer.current = null
        setMergedUndo(null)
        try {
            await sessionAPI.unarchiveSessions(mergedUndo.sessionIds)
        } catch (error) {
            console.error('Failed to unarchive sessions', error)
        }
        refreshLists()
    }

    /** stop only interrupts the agent, so the list is read again now and a moment later */
    const stopMany = (sessionIds: string[]) => {
        sessionIds.forEach((sessionId) => generationAPI.stopSessionStream(sessionId))
        void queryClient.invalidateQueries({ queryKey: ['sessions'] })
        setTimeout(
            () => void queryClient.invalidateQueries({ queryKey: ['sessions'] }),
            STOP_REFRESH_MS
        )
    }

    const stop = (sessionId: string) => stopMany([sessionId])

    /** deletes without the modal: the phone sheet asks with a second tap instead (P7-b) */
    const deleteNow = (sessionId: string) => {
        deleteMutation.mutate(sessionId)
        leaveIfCurrent(sessionId)
    }

    const modals = (
        <>
            <SessionRenameModal
                isOpen={renameModal.isOpen}
                value={renameModal.value}
                isPending={renameMutation.isPending}
                onClose={() => setRenameModal(closedRename)}
                onChange={(value) => setRenameModal((prev) => ({ ...prev, value }))}
                onSubmit={(event) => {
                    event.preventDefault()
                    const value = renameModal.value.trim()
                    if (!renameModal.project || !value) return
                    renameMutation.mutate({ sessionId: renameModal.project.id, rename: value })
                }}
            />
            <SessionDeleteModal
                isOpen={deleteModal.isOpen}
                projectTitle={deleteModal.project?.title}
                isPending={deleteMutation.isPending}
                onClose={() => setDeleteModal(closedDelete)}
                onConfirm={() => {
                    if (deleteModal.project) deleteNow(deleteModal.project.id)
                }}
            />
            <SessionTagsModal
                isOpen={tagsModal.isOpen}
                session={tagsModal.project}
                isPending={updateTagsMutation.isPending}
                onClose={() => setTagsModal(closedTags)}
                onSave={(tags) => {
                    if (!tagsModal.project) return
                    updateTagsMutation.mutate(
                        { sessionId: tagsModal.project.id, tags },
                        { onSuccess: () => setTagsModal(closedTags) }
                    )
                }}
            />
        </>
    )

    return {
        currentSessionId,
        undo,
        undoArchive,
        toggleArchive,
        togglePin,
        mergedUndo,
        archiveMerged,
        undoArchiveMerged,
        stop,
        stopMany,
        deleteNow,
        openRename: (session: BackendSession) =>
            setRenameModal({ isOpen: true, project: session as any, value: session.title || '' }),
        openTags: (session: BackendSession) => setTagsModal({ isOpen: true, project: session }),
        openDelete: (session: BackendSession) =>
            setDeleteModal({ isOpen: true, project: session as any }),
        modals,
    }
}
