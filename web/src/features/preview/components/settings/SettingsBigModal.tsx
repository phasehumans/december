import {
    Sliders,
    Share,
    Plug,
    Cloud,
    Terminal,
    Globe,
    Activity,
    ChevronLeft,
    X,
    Settings,
} from 'lucide-react'
import React, { useState, useEffect } from 'react'

import { GeneralTab } from './GeneralTab'
import { PublishTab } from './PublishTab'
import { BigModalOverlay, PremiumToggle } from './SettingsFormControls'
import { ShareTab } from './ShareTab'

import { projectAPI } from '@/features/projects/api/project'
import { ProjectDeleteModal } from '@/features/projects/components/ProjectDeleteModal'
import { ProjectDuplicateModal } from '@/features/projects/components/ProjectDuplicateModal'
import { ProjectShareModal } from '@/features/projects/components/ProjectShareModal'

interface SettingsModalProps {
    onClose: () => void
    initialTab:
        | 'general'
        | 'share'
        | 'integrations'
        | 'variables'
        | 'domains'
        | 'analytics'
        | 'publish'
    projectName: string
    projectId?: string | null
}

export const SettingsBigModal: React.FC<SettingsModalProps> = ({
    onClose,
    initialTab,
    projectName,
    projectId,
}) => {
    const [activeTab, setActiveTab] = useState(initialTab)
    const [projName, setProjName] = useState(projectName)
    const [projDesc, setProjDesc] = useState('')
    const [category, setCategory] = useState<
        'LANDING_PAGE' | 'DASHBOARD' | 'PORTFOLIO_BLOG' | 'SAAS_APP' | 'ECOMMERCE' | 'NONE'
    >('NONE')
    const [isFavorite, setIsFavorite] = useState(false)
    const [isTemplate, setIsTemplate] = useState(false)
    const [visibility, setVisibility] = useState<'private' | 'link' | 'public'>('link')

    // Toggles state
    const [analytics, setAnalytics] = useState(true)

    // Collaborators mock state
    const [email, setEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('edit')

    // Publish states
    const [env, setEnv] = useState('production')
    const [subDomain, setSubDomain] = useState('my-awesome-app')
    const [customDomain, setCustomDomain] = useState('')
    const [pwdProtection, setPwdProtection] = useState(false)
    const [noIndex, setNoIndex] = useState(false)
    const [deploying, setDeploying] = useState(false)
    const [deployed, setDeployed] = useState(false)

    // Modals state
    const [isShareModalOpen, setIsShareModalOpen] = useState(false)
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

    const handleDeploy = () => {
        setDeploying(true)
        setTimeout(() => {
            setDeploying(false)
            setDeployed(true)
            setTimeout(() => setDeployed(false), 3000)
        }, 1800)
    }

    // Fetch and Save states
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isDuplicating, setIsDuplicating] = useState(false)

    // Fetch project details on mount to populate General tab fields
    useEffect(() => {
        if (!projectId) return
        setIsLoading(true)
        projectAPI
            .getProject(projectId)
            .then((res) => {
                if (res?.project) {
                    setProjName(res.project.name)
                    setProjDesc(res.project.description ?? '')
                    setIsFavorite(res.project.isStarred)
                    setIsTemplate(res.project.isSharedAsTemplate)
                    setCategory((res.project.projectCategory as any) ?? 'NONE')
                }
            })
            .catch((err) => console.error('Failed to load project details:', err))
            .finally(() => setIsLoading(false))
    }, [projectId])

    // Save changes via project patch endpoint
    const handleSaveChanges = async () => {
        if (!projectId) return
        setIsSaving(true)
        try {
            await projectAPI.updateGeneralSettings(projectId, {
                name: projName,
                description: projDesc || null,
                isStarred: isFavorite,
                isSharedAsTemplate: isTemplate,
                projectCategory: category,
            })
            onClose()
            // Quick page reload to reflect project changes
            window.location.reload()
        } catch (err) {
            console.error('Failed to save project settings:', err)
        } finally {
            setIsSaving(false)
        }
    }

    // Duplicate project logic from modal confirm
    const handleDuplicateConfirm = async (newName: string) => {
        if (!projectId) return
        setIsDuplicating(true)
        try {
            const res = await projectAPI.duplicateProject(projectId, newName.trim() || undefined)
            if (res?.id) {
                window.location.href = `/project/${res.id}`
            }
        } catch (err) {
            console.error('Failed to duplicate project:', err)
        } finally {
            setIsDuplicating(false)
            setIsDuplicateModalOpen(false)
        }
    }

    // Share/Unshare project logic from modal confirm
    const handleShareConfirm = async (selectedCategory?: string) => {
        if (!projectId) return
        try {
            await projectAPI.updateGeneralSettings(projectId, {
                isSharedAsTemplate: !isTemplate,
                projectCategory: (selectedCategory as any) ?? 'NONE',
            })
            setIsTemplate(!isTemplate)
            if (selectedCategory) {
                setCategory((selectedCategory as any) ?? 'NONE')
            }
        } catch (err) {
            console.error('Failed to share project:', err)
        } finally {
            setIsShareModalOpen(false)
        }
    }

    // Delete project logic from modal confirm
    const handleDeleteConfirm = async () => {
        if (!projectId) return
        try {
            await projectAPI.deleteProject(projectId)
            window.location.href = '/'
        } catch (err) {
            console.error('Failed to delete project:', err)
        } finally {
            setIsDeleteModalOpen(false)
        }
    }

    const tabs = [
        { id: 'general', label: 'General', icon: <Sliders size={15} /> },
        { id: 'share', label: 'Share', icon: <Share size={15} /> },
        {
            id: 'integrations',
            label: 'Integrations',
            icon: <Plug size={15} className="rotate-45" />,
        },
        { id: 'publish', label: 'Publish', icon: <Cloud size={15} /> },
        { id: 'variables', label: 'Env Variables', icon: <Terminal size={15} /> },
        { id: 'domains', label: 'Domains', icon: <Globe size={15} /> },
        { id: 'analytics', label: 'Analytics', icon: <Activity size={15} /> },
    ]

    return (
        <BigModalOverlay title="Project Settings" icon={<Settings size={16} />} onClose={onClose}>
            {/* Sidebar */}
            <div className="w-[220px] shrink-0 border-r border-[#242323] flex flex-col py-4">
                <div className="px-4 mb-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center text-[#7B7A79] hover:text-[#D6D5D4] hover:bg-[#1E1D1B] px-2 py-1 -ml-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Back
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-[2px] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#383736]/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                    <div className="px-3 py-2 text-[12px] font-medium text-[#7B7A79] mb-1 select-none">
                        Settings
                    </div>
                    {tabs.map((t) => (
                        <button
                            type="button"
                            key={t.id}
                            onClick={() => setActiveTab(t.id as any)}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors text-left outline-none w-full cursor-pointer ${
                                activeTab === t.id
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#1E1D1B]'
                            }`}
                        >
                            <span className="text-[#7B7A79] flex items-center justify-center">
                                {React.cloneElement(t.icon, {
                                    strokeWidth: 1.5,
                                    className: `w-[18px] h-[18px] ${t.icon.props.className || ''}`,
                                })}
                            </span>
                            <span>{t.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Pane */}
            <div className="flex-1 flex flex-col min-w-0 h-full bg-[#171615]">
                {/* Header Actions */}
                <div className="h-10 flex items-center justify-end px-5 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-[#7B7A79] hover:text-[#D6D5D4] hover:bg-white/5 transition-colors outline-none cursor-pointer"
                    >
                        <X size={15} />
                    </button>
                </div>
                {/* Content Area */}
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 p-5">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20 text-[#7B7A79] text-[13px]">
                            Loading settings...
                        </div>
                    ) : (
                        <>
                            {activeTab === 'general' && (
                                <GeneralTab
                                    projName={projName}
                                    setProjName={setProjName}
                                    projDesc={projDesc}
                                    setProjDesc={setProjDesc}
                                    isFavorite={isFavorite}
                                    setIsFavorite={setIsFavorite}
                                    isTemplate={isTemplate}
                                    onOpenShareModal={() => setIsShareModalOpen(true)}
                                    onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
                                    handleSaveChanges={handleSaveChanges}
                                    isSaving={isSaving}
                                />
                            )}

                            {activeTab === 'publish' && (
                                <PublishTab
                                    env={env}
                                    setEnv={setEnv}
                                    subDomain={subDomain}
                                    setSubDomain={setSubDomain}
                                    customDomain={customDomain}
                                    setCustomDomain={setCustomDomain}
                                    pwdProtection={pwdProtection}
                                    setPwdProtection={setPwdProtection}
                                    noIndex={noIndex}
                                    setNoIndex={setNoIndex}
                                    deploying={deploying}
                                    deployed={deployed}
                                    handleDeploy={handleDeploy}
                                />
                            )}

                            {activeTab === 'share' && (
                                <ShareTab
                                    visibility={visibility}
                                    setVisibility={setVisibility}
                                    email={email}
                                    setEmail={setEmail}
                                    inviteRole={inviteRole}
                                    setInviteRole={setInviteRole}
                                />
                            )}

                            {activeTab === 'integrations' && (
                                <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in duration-200">
                                    <h1 className="text-[16px] font-medium mb-3">Integrations</h1>
                                    <div className="flex flex-col gap-6 border-t border-[#242323] pt-6">
                                        <div className="text-center py-12 text-[#7B7A79] text-[13px]">
                                            Connect third-party tools and services to sync your
                                            project workflow. (Coming Soon)
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'variables' && (
                                <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in duration-200">
                                    <h1 className="text-[16px] font-medium mb-3">
                                        Environment Variables
                                    </h1>
                                    <div className="flex flex-col gap-6 border-t border-[#242323] pt-6">
                                        <div className="text-center py-12 text-[#7B7A79] text-[13px]">
                                            Configure secure environment variables, API tokens, and
                                            secrets. (Coming Soon)
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'domains' && (
                                <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in duration-200">
                                    <h1 className="text-[16px] font-medium mb-3">Domains</h1>
                                    <div className="flex flex-col gap-6 border-t border-[#242323] pt-6">
                                        <div className="text-center py-12 text-[#7B7A79] text-[13px]">
                                            Link a custom branded domain or configure secure
                                            subdomains. (Coming Soon)
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'analytics' && (
                                <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in duration-200">
                                    <h1 className="text-[16px] font-medium mb-3">
                                        Analytics Settings
                                    </h1>
                                    <div className="flex flex-col gap-6 border-t border-[#242323] pt-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-0.5 text-left">
                                                <span className="text-[14px] text-[#D6D5C9]">
                                                    Enable Analytics
                                                </span>
                                                <span className="text-[13px] text-[#7B7A79]">
                                                    Track compile loops, page loading cycles, and
                                                    visual interactions.
                                                </span>
                                            </div>
                                            <PremiumToggle
                                                active={analytics}
                                                onChange={() => setAnalytics(!analytics)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <ProjectShareModal
                isOpen={isShareModalOpen}
                projectTitle={projName}
                isSharedAsTemplate={isTemplate}
                isPending={false}
                onClose={() => setIsShareModalOpen(false)}
                onConfirm={handleShareConfirm}
            />

            <ProjectDuplicateModal
                isOpen={isDuplicateModalOpen}
                projectTitle={projName}
                isPending={isDuplicating}
                onClose={() => setIsDuplicateModalOpen(false)}
                onConfirm={handleDuplicateConfirm}
            />

            <ProjectDeleteModal
                isOpen={isDeleteModalOpen}
                projectTitle={projName}
                isPending={false}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
            />
        </BigModalOverlay>
    )
}
