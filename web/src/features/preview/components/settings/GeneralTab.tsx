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
