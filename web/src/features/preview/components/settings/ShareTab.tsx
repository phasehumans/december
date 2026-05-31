import { Lock, Globe, Users, UserPlus } from 'lucide-react'
import React from 'react'
import { PremiumInput } from './SettingsFormControls'

interface ShareTabProps {
    visibility: 'private' | 'link' | 'public'
    setVisibility: (val: 'private' | 'link' | 'public') => void
    email: string
    setEmail: (val: string) => void
    inviteRole: string
    setInviteRole: (val: string) => void
}

export const ShareTab: React.FC<ShareTabProps> = ({
    visibility,
    setVisibility,
    email,
    setEmail,
    inviteRole,
    setInviteRole,
}) => {
    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in duration-200">
            <h1 className="text-[16px] font-medium mb-3">Share</h1>
            <div className="flex flex-col gap-6 border-t border-[#242323] pt-6">
                {/* Visibility Cards */}
                <div className="flex flex-col gap-3 text-left">
                    <span className="text-[14px] font-medium text-[#D6D5C9]">Visibility</span>
                    <span className="text-[13px] text-[#7B7A79]">
                        Configure who can see and duplicate this workspace template.
                    </span>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            {
                                id: 'private',
                                label: 'Private',
                                icon: <Lock size={14} />,
                                desc: 'Only you can access',
                            },
                            {
                                id: 'link',
                                label: 'Anyone with Link',
                                icon: <Globe size={14} />,
                                desc: 'Access via preview URL',
                            },
                            {
                                id: 'public',
                                label: 'Public',
                                icon: <Users size={14} />,
                                desc: 'Shared on Templates',
                            },
                        ].map((opt) => (
                            <button
                                type="button"
                                key={opt.id}
                                onClick={() => setVisibility(opt.id as any)}
                                className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-colors outline-none cursor-pointer ${
                                    visibility === opt.id
                                        ? 'bg-[#242323] border-[#383736] text-[#D6D5C9]'
                                        : 'bg-[#1A1918] border-[#2B2A29] text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#1E1D1B]'
                                }`}
                            >
                                <div className="flex items-center gap-2 font-semibold text-[13px]">
                                    {opt.icon}
                                    <span>{opt.label}</span>
                                </div>
                                <span className="text-[11px] opacity-75">{opt.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Invite User */}
                <div className="flex flex-col gap-3 text-left">
                    <span className="text-[14px] font-medium text-[#D6D5C9]">
                        Invite Collaborator
                    </span>
                    <span className="text-[13px] text-[#7B7A79]">
                        Add team members directly to this project workspace.
                    </span>
                    <div className="flex gap-2">
                        <PremiumInput
                            placeholder="collaborator@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="flex-1"
                        />
                        <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="bg-[#1A1918] border border-[#2B2A29] rounded-xl px-3.5 py-2 text-[13px] text-[#D6D5C9] outline-none cursor-pointer"
                        >
                            <option value="view">View</option>
                            <option value="edit">Edit</option>
                            <option value="admin">Admin</option>
                        </select>
                        <button
                            type="button"
                            className="px-4 py-2 border border-[#383736] rounded-lg text-[13px] font-medium text-[#D6D5C9] hover:bg-[#242323] transition-colors shadow-sm flex items-center gap-1.5 outline-none font-sans cursor-pointer"
                        >
                            <UserPlus size={14} />
                            <span>Invite</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
