import { Users, UserPlus, Loader2, Trash2, AlertCircle, CheckCircle2, X } from 'lucide-react'
import React, { useState, useEffect } from 'react'

import { PremiumInput } from './SettingsFormControls'

import type { Profile } from '@/features/profile/api/profile'

import { projectAPI, type BackendProject } from '@/features/sessions/api/project'

interface ShareTabProps {
    visibility: 'private' | 'link' | 'public'
    setVisibility: (val: 'private' | 'link' | 'public') => void
    email: string
    setEmail: (val: string) => void
    inviteRole: string
    setInviteRole: (val: string) => void
    projectId: string | null
    project?: BackendProject | null
    profile?: Profile | null
}

interface Collaborator {
    id: string
    projectId: string
    userId: string
    email: string
    createdAt: string
    user?: {
        username: string
        name?: string | null
    }
}

export const ShareTab: React.FC<ShareTabProps> = ({
    email,
    setEmail,
    projectId,
    project,
    profile,
}) => {
    const [collaborators, setCollaborators] = useState<Collaborator[]>([])
    const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false)
    const [isInviting, setIsInviting] = useState(false)
    const [removingEmail, setRemovingEmail] = useState<string | null>(null)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)

    const isOwner = profile?.id === project?.userId

    // fetch initial collaborators
    useEffect(() => {
        if (!projectId) return
        const fetchCollabs = async () => {
            try {
                setIsLoadingCollaborators(true)
                const data = await projectAPI.getCollaborators(projectId)
                setCollaborators(data)
            } catch (err) {
                console.error('Failed to fetch collaborators:', err)
            } finally {
                setIsLoadingCollaborators(false)
            }
        }
        fetchCollabs()
    }, [projectId])

    const handleInvite = async () => {
        if (!projectId || !email.trim()) return
        setErrorMsg(null)
        setSuccessMsg(null)

        if (collaborators.length >= 3) {
            setErrorMsg('Maximum limit of 3 collaborators reached.')
            return
        }

        setIsInviting(true)
        try {
            await projectAPI.addCollaborator(projectId, email.trim())
            const data = await projectAPI.getCollaborators(projectId)
            setCollaborators(data)
            setEmail('')
            setSuccessMsg('Collaborator added successfully!')
        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to add collaborator.')
        } finally {
            setIsInviting(false)
        }
    }

    const handleRemove = async (collabEmail: string) => {
        if (!projectId) return
        setErrorMsg(null)
        setSuccessMsg(null)
        setRemovingEmail(collabEmail)
        try {
            await projectAPI.removeCollaborator(projectId, collabEmail)
            setCollaborators((prev) => prev.filter((c) => c.email !== collabEmail))
            setSuccessMsg('Collaborator removed successfully!')
        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to remove collaborator.')
        } finally {
            setRemovingEmail(null)
        }
    }

    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in duration-200">
            <h1 className="text-[16px] font-medium mb-3 text-left">Share & Collaboration</h1>
            <div className="flex flex-col gap-8 border-t border-[#242323] pt-6">
                {/* banners */}
                {errorMsg && (
                    <div className="flex items-center justify-between gap-3 bg-red-950/40 border border-red-900/50 text-red-200 px-4 py-3 rounded-xl text-[13px] animate-in fade-in duration-200 text-left shadow-sm">
                        <div className="flex items-center gap-2.5">
                            <AlertCircle size={16} className="text-red-400 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setErrorMsg(null)}
                            className="p-1 hover:bg-red-900/40 rounded-lg text-red-400 hover:text-red-200 transition-colors cursor-pointer outline-none"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* success banner */}
                {successMsg && (
                    <div className="flex items-center justify-between gap-3 bg-emerald-950/40 border border-emerald-900/50 text-emerald-200 px-4 py-3 rounded-xl text-[13px] animate-in fade-in duration-200 text-left shadow-sm">
                        <div className="flex items-center gap-2.5">
                            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                            <span>{successMsg}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSuccessMsg(null)}
                            className="p-1 hover:bg-emerald-900/40 rounded-lg text-emerald-400 hover:text-emerald-200 transition-colors cursor-pointer outline-none"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* invite user */}
                {isOwner && (
                    <div className="flex flex-col gap-3 text-left">
                        <span className="text-[14px] font-medium text-[#D6D5C9]">
                            Invite Collaborator
                        </span>
                        <span className="text-[13px] text-[#7B7A79]">
                            Enter exact username or email to grant access to this project workspace.
                        </span>
                        <div className="flex gap-2 items-center">
                            <PremiumInput
                                placeholder="username or user@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="flex-1"
                            />
                            <button
                                type="button"
                                onClick={handleInvite}
                                disabled={isInviting || !email.trim()}
                                className="px-5 py-2 bg-white text-black hover:bg-neutral-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-[13px] font-semibold transition-all shadow-md flex items-center gap-1.5 outline-none h-[42px] cursor-pointer min-w-[100px] justify-center"
                            >
                                {isInviting ? (
                                    <Loader2 size={14} className="animate-spin text-black" />
                                ) : (
                                    <>
                                        <UserPlus size={14} />
                                        <span>Invite</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* collaborators list (minimal & list view) */}
                <div className="flex flex-col gap-3 text-left">
                    <span className="text-[14px] font-medium text-[#D6D5C9]">
                        Active Collaborators
                    </span>
                    <div className="flex flex-col divide-y divide-[#242323] border border-[#242323] rounded-xl bg-[#141414] overflow-hidden">
                        {/* project owner row */}
                        {project?.user && (
                            <div className="flex items-center justify-between px-4 py-3.5 hover:bg-[#1A1918] transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-[#2A2928] border border-[#3C3B3A] flex items-center justify-center font-semibold text-[13px] text-[#D6D5C9] shrink-0">
                                        {project.user.username.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[13px] font-medium text-white truncate">
                                            {project.user.username}
                                        </span>
                                        <span className="text-[12px] text-[#7B7A79] truncate">
                                            @{project.user.username} (Owner)
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* collaborator rows */}
                        {isLoadingCollaborators ? (
                            <div className="flex items-center justify-center py-8 text-[#7B7A79] text-[13px] gap-2">
                                <Loader2 size={16} className="animate-spin text-[#7B7A79]" />
                                <span>Loading collaborators...</span>
                            </div>
                        ) : collaborators.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 text-center gap-2">
                                <Users size={22} className="text-[#7B7A79]" />
                                <span className="text-[13px] font-medium text-[#D6D5C9]">
                                    No collaborators added yet
                                </span>
                                <span className="text-[12px] text-[#7B7A79] max-w-[280px]">
                                    {isOwner
                                        ? 'Use the invite input above to add team members.'
                                        : 'Only the project owner can add collaborators.'}
                                </span>
                            </div>
                        ) : (
                            collaborators.map((collab) => (
                                <div
                                    key={collab.id}
                                    className="flex items-center justify-between px-4 py-3.5 hover:bg-[#1A1918] transition-colors group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-[#2A2928] border border-[#3C3B3A] flex items-center justify-center font-semibold text-[13px] text-[#D6D5C9] shrink-0">
                                            {(collab.user?.username || collab.email)
                                                .charAt(0)
                                                .toUpperCase()}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[13px] font-medium text-white truncate">
                                                {collab.user?.name ||
                                                    collab.user?.username ||
                                                    collab.email}
                                            </span>
                                            <span className="text-[12px] text-[#7B7A79] truncate">
                                                {collab.user?.username
                                                    ? `@${collab.user.username} (${collab.email})`
                                                    : collab.email}
                                            </span>
                                        </div>
                                    </div>
                                    {isOwner && (
                                        <div className="flex items-center">
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(collab.email)}
                                                disabled={removingEmail === collab.email}
                                                title="Remove collaborator"
                                                className="p-1.5 hover:bg-red-950/40 border border-transparent hover:border-red-900/50 rounded-lg text-[#7B7A79] hover:text-red-400 transition-all cursor-pointer outline-none disabled:opacity-50"
                                            >
                                                {removingEmail === collab.email ? (
                                                    <Loader2
                                                        size={15}
                                                        className="animate-spin text-red-400"
                                                    />
                                                ) : (
                                                    <Trash2 size={15} />
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
