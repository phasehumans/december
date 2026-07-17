import { Sliders, Cloud, Terminal, Github, ChevronLeft, Settings, Share2 } from 'lucide-react'
import React from 'react'

import { GeneralTab } from './GeneralTab'
import { GithubTab } from './GithubTab'
import { PublishTab } from './PublishTab'
import { BigModalOverlay } from './SettingsFormControls'
import { ShareTab } from './ShareTab'

import { useSettingsModalController } from '@/features/preview/hooks/useSettingsModalController'
import { SessionDeleteModal } from '@/features/sessions/components/SessionDeleteModal'
import { SessionDuplicateModal } from '@/features/sessions/components/SessionDuplicateModal'
import { SessionShareModal } from '@/features/sessions/components/SessionShareModal'

const VercelIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M24 22.525H0L12 1.745L24 22.525Z" />
    </svg>
)

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
        | 'vercel'
    projectName: string
    projectId?: string | null
}

export const SettingsBigModal: React.FC<SettingsModalProps> = ({
    onClose,
    initialTab,
    projectName,
    projectId,
}) => {
    const {
        activeTab,
        setActiveTab,
        projName,
        setProjName,
        projDesc,
        setProjDesc,
        isFavorite,
        setIsFavorite,
        isTemplate,
        visibility,
        setVisibility,
        email,
        setEmail,
        inviteRole,
        setInviteRole,
        deploying,
        deployed,
        buildLogs,
        deployError,
        vercelDeploymentUrl,
        vercelLastDeployedAt,
        isShareModalOpen,
        setIsShareModalOpen,
        isDuplicateModalOpen,
        setIsDuplicateModalOpen,
        isDeleteModalOpen,
        setIsDeleteModalOpen,
        project,
        profile,
        githubRepoName,
        setGithubRepoName,
        githubIsPrivate,
        setGithubIsPrivate,
        isCreatingRepo,
        isSyncingRepo,
        githubCommitMsg,
        setGithubCommitMsg,
        githubSyncError,
        githubSyncSuccess,
        isLoading,
        isSaving,
        isDuplicating,
        handleConnectGithub,
        handleConnectVercel,
        handleCreateGithubRepo,
        handleSyncGithubRepo,
        handleDeploy,
        handleSaveChanges,
        handleClose,
        handleDuplicateConfirm,
        handleShareConfirm,
        handleDeleteConfirm,
    } = useSettingsModalController(initialTab, projectName, projectId, onClose)

    const tabs = [
        { id: 'general', label: 'General', icon: <Sliders size={15} /> },
        { id: 'share', label: 'Share', icon: <Share2 size={15} /> },
        { id: 'integrations', label: 'GitHub', icon: <Github size={15} /> },
        { id: 'vercel', label: 'Vercel', icon: <VercelIcon className="w-[15px] h-[15px]" /> },
        { id: 'variables', label: 'Env Variables', icon: <Terminal size={15} /> },
        { id: 'publish', label: 'Publish', icon: <Cloud size={15} /> },
    ]

    return (
        <BigModalOverlay
            title="Project Settings"
            icon={<Settings size={16} />}
            onClose={handleClose}
        >
            {/* Sidebar */}
            <div className="w-[220px] shrink-0 border-r border-[#242323] flex flex-col py-4 bg-[#141414]">
                <div className="px-4 mb-6">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="flex items-center text-[#7B7A79] hover:text-[#D6D5D4] hover:bg-[#191919] px-2 py-1 -ml-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer"
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
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <span className="flex items-center justify-center">
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
            <div className="flex-1 flex flex-col min-w-0 h-full bg-[#141414] relative">
                {/* Content Area */}
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 p-8 pr-16">
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

                            {activeTab === 'vercel' && (
                                <PublishTab
                                    deploying={deploying}
                                    deployed={deployed}
                                    handleDeploy={handleDeploy}
                                    buildLogs={buildLogs}
                                    deployError={deployError}
                                    vercelDeploymentUrl={vercelDeploymentUrl}
                                    vercelLastDeployedAt={vercelLastDeployedAt}
                                    githubRepoName={project?.githubRepoName || null}
                                    isVercelConnected={profile?.vercelConnected || false}
                                    isGithubConnected={profile?.githubConnected || false}
                                    handleConnectGithub={handleConnectGithub}
                                    handleConnectVercel={handleConnectVercel}
                                    onSwitchToGithubTab={() => setActiveTab('integrations')}
                                />
                            )}

                            {activeTab === 'publish' && (
                                <div className="max-w-2xl animate-in fade-in duration-200">
                                    <div className="border-b border-[#242323] pb-6 mb-8">
                                        <h2 className="text-[20px] font-semibold text-[#D6D5C9] tracking-tight mb-1">
                                            Publish
                                        </h2>
                                        <p className="text-[13px] text-[#7B7A79]">
                                            Deploy and manage your project publications.
                                        </p>
                                    </div>
                                    <div className="border border-[#242323] rounded-2xl p-12 text-center bg-[#191919]/50 flex flex-col items-center justify-center">
                                        <Cloud className="w-8 h-8 text-[#7B7A79] mb-3" />
                                        <h3 className="text-[14px] font-medium text-[#D6D5C9] mb-1">
                                            No publications yet
                                        </h3>
                                        <p className="text-[13px] text-[#7B7A79] max-w-sm">
                                            Your published projects will appear here once
                                            configured.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'share' && (
                                <ShareTab
                                    visibility={visibility}
                                    setVisibility={setVisibility}
                                    email={email}
                                    setEmail={setEmail}
                                    inviteRole={inviteRole}
                                    setInviteRole={setInviteRole}
                                    projectId={projectId}
                                    project={project}
                                    profile={profile}
                                />
                            )}

                            {activeTab === 'integrations' && (
                                <GithubTab
                                    profile={profile}
                                    project={project}
                                    githubRepoName={githubRepoName}
                                    setGithubRepoName={setGithubRepoName}
                                    githubIsPrivate={githubIsPrivate}
                                    setGithubIsPrivate={setGithubIsPrivate}
                                    isCreatingRepo={isCreatingRepo}
                                    githubSyncError={githubSyncError}
                                    githubSyncSuccess={githubSyncSuccess}
                                    githubCommitMsg={githubCommitMsg}
                                    setGithubCommitMsg={setGithubCommitMsg}
                                    isSyncingRepo={isSyncingRepo}
                                    handleConnectGithub={handleConnectGithub}
                                    handleCreateGithubRepo={handleCreateGithubRepo}
                                    handleSyncGithubRepo={handleSyncGithubRepo}
                                />
                            )}

                            {activeTab === 'variables' && (
                                <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in duration-200">
                                    <h1 className="text-[16px] font-medium mb-3">
                                        Environment Variables
                                    </h1>
                                    <div className="flex flex-col gap-4 border-t border-[#242323] pt-6">
                                        <p className="text-[13px] text-[#7B7A79] mb-2">
                                            Manage your environment variables and secrets here.
                                            These are encrypted at rest.
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                placeholder="Key (e.g. DATABASE_URL)"
                                                className="flex-1 bg-[#100E12]/50 border border-[#383736] rounded-lg px-3 py-1.5 text-[13px] text-[#D6D5C9] outline-none"
                                                disabled
                                            />
                                            <input
                                                type="text"
                                                placeholder="Value"
                                                className="flex-1 bg-[#100E12]/50 border border-[#383736] rounded-lg px-3 py-1.5 text-[13px] text-[#D6D5C9] outline-none"
                                                disabled
                                            />
                                            <button className="px-4 py-1.5 rounded-lg bg-[#2B2A29] text-[#7B7A79] text-[13px] font-medium cursor-not-allowed">
                                                Add
                                            </button>
                                        </div>
                                        <div className="border border-dashed border-[#383736] rounded-xl py-8 flex flex-col items-center justify-center gap-2 bg-[#100E12]/30 mt-4">
                                            <span className="text-[13px] text-[#7B7A79]">
                                                No environment variables defined yet.
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <SessionShareModal
                isOpen={isShareModalOpen}
                projectTitle={projName}
                isSharedAsTemplate={isTemplate}
                isPending={false}
                onClose={() => setIsShareModalOpen(false)}
                onConfirm={handleShareConfirm}
            />

            <SessionDuplicateModal
                isOpen={isDuplicateModalOpen}
                projectTitle={projName}
                isPending={isDuplicating}
                onClose={() => setIsDuplicateModalOpen(false)}
                onConfirm={handleDuplicateConfirm}
            />

            <SessionDeleteModal
                isOpen={isDeleteModalOpen}
                projectTitle={projName}
                isPending={false}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
            />
        </BigModalOverlay>
    )
}
