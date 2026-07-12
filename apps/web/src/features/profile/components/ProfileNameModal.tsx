import React from 'react'

import type { ProfileNameModalProps } from '@/features/profile/types'

import { Modal } from '@/shared/components/ui/Modal'

export const ProfileNameModal: React.FC<ProfileNameModalProps> = ({
    isOpen,
    value,
    isPending,
    title,
    label,
    errorMessage,
    onClose,
    onChange,
    onSave,
}) => {
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (value.trim() && !isPending) {
            onSave()
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title || 'Change Name'}
            description={`This will immediately update your ${label?.toLowerCase() || 'name'} across the platform.`}
            variant="premium"
        >
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
                <p className="text-[13px] text-[#8F8E8D] leading-relaxed">
                    Enter a new {label?.toLowerCase() || 'name'} for your account. This will be
                    updated across your profile and visible to others.
                </p>
                <div>
                    <input
                        id="profile-name-input"
                        type="text"
                        autoFocus
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full bg-white/[0.03] border border-[#2B2A27] rounded-lg px-3.5 py-2.5 text-white text-[13px] focus:outline-none transition-[border-color,box-shadow] duration-200"
                        placeholder={`Enter new ${label?.toLowerCase() || 'name'}...`}
                        disabled={isPending}
                    />
                </div>

                {errorMessage && (
                    <p className="text-[12px] text-red-500 font-medium px-1 mt-1">{errorMessage}</p>
                )}

                <div className="mt-1 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isPending}
                        className="bg-transparent text-white hover:bg-white/5 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!value.trim() || isPending}
                        className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center min-w-[110px]"
                    >
                        {isPending ? (
                            <div className="flex items-center gap-1.5 justify-center">
                                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                <span>Saving...</span>
                            </div>
                        ) : (
                            'Save Changes'
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
