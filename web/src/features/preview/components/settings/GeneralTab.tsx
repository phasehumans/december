import { useQuery } from '@tanstack/react-query'
import React from 'react'

import { PremiumInput, PremiumTextarea, PremiumToggle } from './SettingsFormControls'

import { profileAPI } from '@/features/profile/api/profile'

interface GeneralTabProps {
    projName: string
    setProjName: (val: string) => void
    projDesc: string
    setProjDesc: (val: string) => void
    isFavorite: boolean
    setIsFavorite: (val: boolean) => void
    isTemplate: boolean
    onOpenShareModal: () => void
    onOpenDeleteModal: () => void
    handleSaveChanges: () => void
    isSaving: boolean
    selectedModel: string
    setSelectedModel: (val: string) => void
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
    projName,
    setProjName,
    projDesc,
    setProjDesc,
    isFavorite,
    setIsFavorite,
    isTemplate,
    onOpenShareModal,
    onOpenDeleteModal,
    handleSaveChanges,
    isSaving,
    selectedModel,
    setSelectedModel,
}) => {
    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
    })

    const isPro = profile?.subscriptionPlan === 'PRO' && profile?.subscriptionStatus === 'ACTIVE'

    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in duration-200">
            <h1 className="text-[16px] font-medium mb-3">General Settings</h1>
            <div className="flex flex-col gap-6 border-t border-[#242323] pt-6">
                <div className="flex flex-col gap-1.5 text-left">
                    <span className="text-[14px] text-[#D6D5C9]">Project Name</span>
                    <span className="text-[13px] text-[#7B7A79] mb-1">
                        Change your project name display title.
                    </span>
                    <PremiumInput value={projName} onChange={(e) => setProjName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1 text-left">
                    <span className="text-[14px] text-[#D6D5C9]">Description</span>
                    <span className="text-[13px] text-[#7B7A79] mb-1">
                        Provide an overview description of this workspace.
                    </span>
                    <PremiumTextarea
                        rows={3}
                        value={projDesc}
                        onChange={(e) => setProjDesc(e.target.value)}
                        placeholder="Write a brief overview of your application..."
                    />
                </div>

                {/* LLM Model Selection Row */}
                <div className="flex flex-col gap-1.5 text-left border-t border-[#242323] pt-6">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Agent LLM Model</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Choose the intelligence driving your workspace agents.
                            </span>
                        </div>
                        {!isPro && (
                            <span className="text-[9px] font-bold bg-[#E8AF30]/10 text-[#E8AF30] border border-[#E8AF30]/20 px-2 py-0.5 rounded-full uppercase tracking-wider select-none">
                                PRO Feature
                            </span>
                        )}
                    </div>
                    {isPro ? (
                        <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="w-full bg-[#1A1918] border border-[#2B2A29] rounded-xl px-3.5 py-2 text-[13px] text-[#D6D5C9] outline-none focus:border-[#4A4948] transition-colors cursor-pointer"
                        >
                            <option value="">Auto Model (Default)</option>
                            <option value="openai/gpt-oss-20b:free">GPT OSS 20B (Free)</option>
                            <option value="meta-llama/llama-3-8b-instruct:free">
                                Llama 3 8B Instruct (Free)
                            </option>
                            <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                            <option value="anthropic/claude-3-haiku">Claude 3 Haiku</option>
                        </select>
                    ) : (
                        <div className="relative">
                            <select
                                disabled
                                value=""
                                className="w-full bg-[#1A1918]/50 border border-[#2B2A29]/50 rounded-xl px-3.5 py-2 text-[13px] text-[#7B7A79] outline-none opacity-60 cursor-not-allowed select-none"
                            >
                                <option value="">Auto Model (Default)</option>
                            </select>
                            <span className="text-[12px] text-[#7B7A79] block mt-1.5 italic">
                                Only PRO users can choose custom LLM models. Upgrade to select other
                                models.
                            </span>
                        </div>
                    )}
                </div>

                {/* Star / Favourite Row */}
                <div className="flex items-center justify-between border-t border-[#242323] pt-6">
                    <div className="flex flex-col gap-0.5 text-left">
                        <span className="text-[14px] text-[#D6D5C9]">Add to Favourites</span>
                        <span className="text-[13px] text-[#7B7A79]">
                            Star this project to make it easily accessible from home.
                        </span>
                    </div>
                    <PremiumToggle
                        active={isFavorite}
                        onChange={() => setIsFavorite(!isFavorite)}
                    />
                </div>

                {/* Share as Template Row */}
                <div className="flex items-center justify-between border-t border-[#242323] pt-6">
                    <div className="flex flex-col gap-0.5 text-left">
                        <span className="text-[14px] text-[#D6D5C9]">
                            {isTemplate ? 'Unshare as Template' : 'Share as Template'}
                        </span>
                        <span className="text-[13px] text-[#7B7A79]">
                            Allow others to duplicate this project as a community layout.
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onOpenShareModal}
                        className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors font-medium cursor-pointer"
                    >
                        {isTemplate ? 'Unshare' : 'Share'}
                    </button>
                </div>

                {/* Delete Project Row */}
                <div className="flex items-center justify-between border-t border-[#242323] pt-6">
                    <div className="flex flex-col gap-0.5 text-left">
                        <span className="text-[14px] text-[#D6D5C9]">Delete Project</span>
                        <span className="text-[13px] text-[#7B7A79]">
                            Permanently delete this project from your workspace.
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onOpenDeleteModal}
                        className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors font-medium cursor-pointer"
                    >
                        Delete
                    </button>
                </div>

                <div className="pt-4 border-t border-[#242323] flex justify-start">
                    <button
                        type="button"
                        onClick={handleSaveChanges}
                        disabled={isSaving}
                        className="px-4 py-1.5 rounded-lg bg-[#E8E7E4] text-[#171615] hover:bg-white font-medium text-[13px] transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    )
}
