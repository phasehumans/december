import { useQuery } from '@tanstack/react-query'
import { Folder, Settings, X, Globe } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { projectAPI } from '@/features/projects/api/project'

interface ProfileCardModalProps {
    isOpen: boolean
    onClose: () => void
    userName: string
    userUsername: string
    onSettings?: () => void
}

type SharedProject = {
    id: string
    name: string
    description: string | null
    createdAt: string
}

export const ProfileCardModal: React.FC<ProfileCardModalProps> = ({
    isOpen,
    onClose,
    userName,
    userUsername,
    onSettings,
}) => {
    const modalRef = useRef<HTMLDivElement>(null)
    const [activeTab, setActiveTab] = useState<'projects' | 'templates'>('projects')

    const [currentAvatarSeed, setCurrentAvatarSeed] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('december_avatar_seed')
            if (saved) return saved
        }
        return userName
    })

    const { data: allProjects = [] } = useQuery({
        queryKey: ['projects'],
        queryFn: projectAPI.getProjects,
        enabled: isOpen,
    })

    const publishedProjects = allProjects.filter((p) => p.projectStatus === 'DEPLOYED')

    const sharedTemplates = allProjects.filter((p) => p.isSharedAsTemplate)

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown)
            document.body.style.overflow = 'hidden'

            // Lock main app scroll container if it exists
            const mainScroll = document.getElementById('main-scroll-container')
            if (mainScroll) mainScroll.style.overflow = 'hidden'
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = 'unset'

            // Restore main app scroll container
            const mainScroll = document.getElementById('main-scroll-container')
            if (mainScroll) mainScroll.style.overflow = 'auto'
        }
    }, [isOpen, onClose])

    if (!isOpen || typeof document === 'undefined') return null

    // For backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    const handleSettingsClick = () => {
        onClose()
        if (onSettings) {
            onSettings()
        }
    }

    const handleChangeAvatar = () => {
        // Generate a random 6-character string as the seed
        const randomSeed = Math.random().toString(36).substring(2, 8)
        setCurrentAvatarSeed(randomSeed)
        if (typeof window !== 'undefined') {
            localStorage.setItem('december_avatar_seed', randomSeed)
        }
    }

    const displayUsername = userUsername || userName.toLowerCase().replace(/\s+/g, '_')

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 p-4"
            onClick={handleBackdropClick}
        >
            <div
                ref={modalRef}
                className="w-full max-w-[760px] bg-[#171615] rounded-2xl shadow-2xl relative overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-[#2B2A29]"
            >
                {/* Banner with CSS Halftone Effect */}
                <div className="relative h-[160px] w-full bg-[#100E12] flex items-center justify-center overflow-hidden">
                    {/* Halftone Pattern Background */}
                    <div
                        className="absolute inset-0 opacity-60"
                        style={{
                            backgroundImage:
                                'radial-gradient(#4A4948 25%, transparent 25%), radial-gradient(#4A4948 25%, transparent 25%)',
                            backgroundPosition: '0 0, 4px 4px',
                            backgroundSize: '8px 8px',
                        }}
                    />
                    {/* Subtle Gradient Overlays */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#171615] via-transparent to-transparent opacity-90" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50 opacity-40" />

                    {/* Banner Text */}
                    <h1
                        className="relative z-10 text-[#D6D5C9] font-mono text-[24px] md:text-[28px] tracking-tight opacity-90"
                        style={{ textShadow: '0 4px 12px rgba(0,0,0,0.8)' }}
                    >
                        december.dev/@{displayUsername}
                    </h1>

                    <button
                        className="absolute top-4 right-4 z-20 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white/70 hover:text-white transition-colors"
                        onClick={onClose}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Profile Info Section */}
                <div className="px-8 pb-8 relative">
                    {/* Avatar */}
                    <button
                        onClick={handleChangeAvatar}
                        className="absolute -top-[48px] left-8 w-[96px] h-[96px] rounded-full border-[5px] border-[#171615] bg-[#2B2A29] overflow-hidden flex items-center justify-center shadow-xl hover:scale-105 hover:border-[#242323] transition-all cursor-pointer group"
                        title="Change Avatar"
                    >
                        <img
                            src={`https://api.dicebear.com/7.x/notionists/svg?seed=${currentAvatarSeed}&backgroundColor=2B2A29`}
                            alt={userName}
                            className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                        />
                    </button>

                    {/* Actions */}
                    <div className="flex justify-end pt-4 gap-3">
                        <button
                            onClick={handleSettingsClick}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[#383736] text-[13px] font-medium text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors"
                        >
                            Account settings
                            <Settings className="w-3.5 h-3.5 text-[#7B7A79]" />
                        </button>
                    </div>

                    {/* User Details — Name + Username */}
                    <div className="flex flex-col mt-2">
                        <h2 className="text-[22px] font-bold text-[#D6D5C9] mb-0.5">{userName}</h2>
                        <span className="text-[14px] text-[#7B7A79]">@{displayUsername}</span>
                    </div>

                    {/* Content Tabs */}
                    <div className="flex gap-6 border-b border-[#242323] mt-6 mb-5">
                        <button
                            onClick={() => setActiveTab('projects')}
                            className={`pb-2.5 text-[14px] font-medium transition-colors border-b-2 ${activeTab === 'projects' ? 'text-[#D6D5C9] border-[#D6D5C9]' : 'text-[#7B7A79] border-transparent hover:text-[#D6D5C9]'}`}
                        >
                            Published Projects
                        </button>
                        <button
                            onClick={() => setActiveTab('templates')}
                            className={`pb-2.5 text-[14px] font-medium transition-colors border-b-2 ${activeTab === 'templates' ? 'text-[#D6D5C9] border-[#D6D5C9]' : 'text-[#7B7A79] border-transparent hover:text-[#D6D5C9]'}`}
                        >
                            Shared Templates
                        </button>
                    </div>

                    {/* Content Area */}
                    {activeTab === 'projects' ? (
                        publishedProjects.length > 0 ? (
                            <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto no-scrollbar">
                                {publishedProjects.map((project) => (
                                    <div
                                        key={project.id}
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#100E12]/50 border border-[#242323] hover:bg-[#1E1D1B] transition-colors"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-[#1E1D1B] border border-[#2B2A29] flex items-center justify-center shrink-0">
                                            <Folder
                                                className="w-4 h-4 text-[#7B7A79]"
                                                strokeWidth={1.5}
                                            />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[14px] font-medium text-[#D6D5C9] truncate">
                                                {project.name}
                                            </span>
                                            {project.description && (
                                                <span className="text-[12px] text-[#7B7A79] truncate">
                                                    {project.description}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="w-full rounded-2xl bg-[#100E12]/50 border border-[#242323] py-12 flex flex-col items-center justify-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-[#1E1D1B] border border-[#2B2A29] flex items-center justify-center shadow-sm">
                                    <Folder className="w-6 h-6 text-[#7B7A79]" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-[15px] font-medium text-[#D6D5C9]">
                                    No published projects yet
                                </h3>
                                <p className="text-[13px] text-[#7B7A79]">
                                    Projects created and published to this profile will appear here
                                </p>
                            </div>
                        )
                    ) : sharedTemplates.length > 0 ? (
                        <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto no-scrollbar">
                            {sharedTemplates.map((project) => (
                                <div
                                    key={project.id}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#100E12]/50 border border-[#242323] hover:bg-[#1E1D1B] transition-colors"
                                >
                                    <div className="w-9 h-9 rounded-lg bg-[#1E1D1B] border border-[#2B2A29] flex items-center justify-center shrink-0">
                                        <Globe
                                            className="w-4 h-4 text-[#7B7A79]"
                                            strokeWidth={1.5}
                                        />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[14px] font-medium text-[#D6D5C9] truncate">
                                            {project.name}
                                        </span>
                                        {project.description && (
                                            <span className="text-[12px] text-[#7B7A79] truncate">
                                                {project.description}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="w-full rounded-2xl bg-[#100E12]/50 border border-[#242323] py-12 flex flex-col items-center justify-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-[#1E1D1B] border border-[#2B2A29] flex items-center justify-center shadow-sm">
                                <Globe className="w-6 h-6 text-[#7B7A79]" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-[15px] font-medium text-[#D6D5C9]">
                                No shared templates yet
                            </h3>
                            <p className="text-[13px] text-[#7B7A79]">
                                Projects you share as templates will appear here
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}
