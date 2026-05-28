import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, X, Bookmark, Calendar, Heart } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import bannerImg from '../../../../public/banner.png'

import { profileAPI } from '@/features/profile/api/profile'
import { projectAPI } from '@/features/projects/api/project'
import { templateAPI } from '@/features/templates/api/template'
import { Skeleton } from '@/shared/components/ui/Skeleton'

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
    const queryClient = useQueryClient()
    const modalRef = useRef<HTMLDivElement>(null)
    const [activeTab, setActiveTab] = useState<'templates' | 'liked'>('templates')

    const { data: profile, isLoading: isProfileLoading } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
        enabled: isOpen,
    })

    const { data: allProjects = [], isLoading: isProjectsLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: projectAPI.getProjects,
        enabled: isOpen,
    })

    const { data: allTemplates = [], isLoading: isTemplatesLoading } = useQuery({
        queryKey: ['templates'],
        queryFn: templateAPI.getTemplates,
        enabled: isOpen,
    })

    const isLoading = isProfileLoading || isProjectsLoading || isTemplatesLoading

    const sharedTemplates = allProjects.filter((p) => p.isSharedAsTemplate)
    const likedTemplates = allTemplates.filter((t) => t.isLiked)

    const updateAvatarMutation = useMutation({
        mutationFn: profileAPI.updateAvatarUrl,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] })
        },
    })

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
        const randomSeed = Math.random().toString(36).substring(2, 8)
        const newUrl = `https://api.dicebear.com/7.x/notionists/svg?seed=${randomSeed}&backgroundColor=2B2A29`
        updateAvatarMutation.mutate({ avatarUrl: newUrl })
    }

    const currentAvatarUrl =
        profile?.avatarUrl ||
        `https://api.dicebear.com/7.x/notionists/svg?seed=${userName}&backgroundColor=2B2A29`

    const displayUsername = userUsername || userName.toLowerCase().replace(/\s+/g, '_')

    const joinDateStr = profile?.createdAt
        ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
              new Date(profile.createdAt)
          )
        : ''

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 p-4"
            onClick={handleBackdropClick}
        >
            <div
                ref={modalRef}
                className="w-full max-w-[760px] bg-[#171615] rounded-2xl shadow-2xl relative overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-[#2B2A29]"
            >
                {/* Banner with Image */}
                <div className="relative h-[160px] w-full bg-[#100E12] flex items-center justify-center overflow-hidden">
                    <img
                        src={bannerImg}
                        alt="Profile Banner"
                        className="absolute inset-0 w-full h-full object-cover scale-[1.35] object-center"
                    />
                    {/* Subtle Gradient Overlays */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#171615] via-[#171615]/40 to-transparent opacity-90" />

                    {/* Banner Text */}
                    <h1
                        className="relative z-10 text-[#D6D5C9] font-mono text-[24px] md:text-[28px] tracking-tight opacity-90"
                        style={{ textShadow: '0 4px 12px rgba(0,0,0,0.8)' }}
                    >
                        december.com/@{displayUsername}
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
                        disabled={isLoading}
                        className="absolute -top-[48px] left-8 w-[96px] h-[96px] rounded-full border-[5px] border-[#171615] bg-[#2B2A29] overflow-hidden flex items-center justify-center shadow-xl hover:scale-105 hover:border-[#242323] transition-all cursor-pointer group"
                        title="Change Avatar"
                    >
                        {isLoading ? (
                            <Skeleton className="w-full h-full rounded-full bg-white/[0.06]" />
                        ) : (
                            <img
                                src={currentAvatarUrl}
                                alt={userName}
                                className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                            />
                        )}
                    </button>

                    {/* Actions */}
                    <div className="flex justify-end pt-4 gap-3">
                        {isLoading ? (
                            <Skeleton className="h-8 w-36 rounded-full bg-white/[0.04]" />
                        ) : (
                            <button
                                onClick={handleSettingsClick}
                                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[#383736] text-[13px] font-medium text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors"
                            >
                                Account settings
                                <Settings className="w-3.5 h-3.5 text-[#7B7A79]" />
                            </button>
                        )}
                    </div>

                    {/* User Details — Name + Username */}
                    <div className="flex flex-col mt-2">
                        {isLoading ? (
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-7 w-48 bg-white/[0.06] rounded-md" />
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-4 w-20 bg-white/[0.04] rounded-md" />
                                    <Skeleton className="h-4 w-32 bg-white/[0.04] rounded-md" />
                                </div>
                            </div>
                        ) : (
                            <>
                                <h2 className="text-[22px] font-bold text-[#D6D5C9] mb-0.5">
                                    {userName}
                                </h2>
                                <div className="flex items-center gap-3">
                                    <span className="text-[14px] text-[#7B7A79]">
                                        @{displayUsername}
                                    </span>
                                    {joinDateStr && (
                                        <span className="text-[13px] text-[#7B7A79] flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            Joined {joinDateStr}
                                        </span>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Content Tabs */}
                    <div className="flex gap-6 border-b border-[#242323] mt-6 mb-5">
                        <button
                            onClick={() => setActiveTab('templates')}
                            disabled={isLoading}
                            className={`pb-2.5 text-[14px] font-medium transition-colors border-b-2 ${activeTab === 'templates' ? 'text-[#D6D5C9] border-[#D6D5C9]' : 'text-[#7B7A79] border-transparent hover:text-[#D6D5C9]'}`}
                        >
                            Shared Templates
                        </button>
                        <button
                            onClick={() => setActiveTab('liked')}
                            disabled={isLoading}
                            className={`pb-2.5 text-[14px] font-medium transition-colors border-b-2 ${activeTab === 'liked' ? 'text-[#D6D5C9] border-[#D6D5C9]' : 'text-[#7B7A79] border-transparent hover:text-[#D6D5C9]'}`}
                        >
                            Liked Templates
                        </button>
                    </div>

                    {/* Content Area */}
                    {isLoading ? (
                        <div className="flex flex-col gap-2 h-[240px] overflow-y-auto no-scrollbar">
                            {[1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#100E12]/30 border border-[#242323]/50"
                                >
                                    <Skeleton className="w-9 h-9 rounded-lg bg-white/[0.06] shrink-0" />
                                    <div className="flex flex-col gap-2 flex-1">
                                        <Skeleton className="h-4 w-1/3 bg-white/[0.06] rounded-md" />
                                        <Skeleton className="h-3 w-1/2 bg-white/[0.04] rounded-md" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : activeTab === 'templates' ? (
                        sharedTemplates.length > 0 ? (
                            <div className="flex flex-col gap-2 h-[240px] overflow-y-auto no-scrollbar">
                                {sharedTemplates.map((project) => (
                                    <div
                                        key={project.id}
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#100E12]/50 border border-[#242323] hover:bg-[#1E1D1B] transition-colors"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-[#1E1D1B] border border-[#2B2A29] flex items-center justify-center shrink-0">
                                            <Bookmark
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
                            <div className="w-full h-[240px] rounded-2xl bg-[#100E12]/50 border border-[#242323] flex flex-col items-center justify-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-[#1E1D1B] border border-[#2B2A29] flex items-center justify-center shadow-sm">
                                    <Bookmark
                                        className="w-6 h-6 text-[#7B7A79]"
                                        strokeWidth={1.5}
                                    />
                                </div>
                                <h3 className="text-[15px] font-medium text-[#D6D5C9]">
                                    No shared templates yet
                                </h3>
                                <p className="text-[13px] text-[#7B7A79]">
                                    Projects you share as templates will appear here
                                </p>
                            </div>
                        )
                    ) : likedTemplates.length > 0 ? (
                        <div className="flex flex-col gap-2 h-[240px] overflow-y-auto no-scrollbar">
                            {likedTemplates.map((template) => (
                                <div
                                    key={template.id}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#100E12]/50 border border-[#242323] hover:bg-[#1E1D1B] transition-colors"
                                >
                                    <div className="w-9 h-9 rounded-lg bg-[#1E1D1B] border border-[#2B2A29] flex items-center justify-center shrink-0">
                                        <Heart
                                            className="w-4 h-4 text-[#7B7A79]"
                                            strokeWidth={1.5}
                                        />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[14px] font-medium text-[#D6D5C9] truncate">
                                            {template.name}
                                        </span>
                                        {template.description && (
                                            <span className="text-[12px] text-[#7B7A79] truncate">
                                                {template.description}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="w-full h-[240px] rounded-2xl bg-[#100E12]/50 border border-[#242323] flex flex-col items-center justify-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-[#1E1D1B] border border-[#2B2A29] flex items-center justify-center shadow-sm">
                                <Heart className="w-6 h-6 text-[#7B7A79]" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-[15px] font-medium text-[#D6D5C9]">
                                No liked templates yet
                            </h3>
                            <p className="text-[13px] text-[#7B7A79]">
                                Templates you like will appear here
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}
