import {
    Sliders,
    Cloud,
    Terminal,
    Globe,
    ChevronLeft,
    Settings,
    Github,
    Lock,
    ExternalLink,
    CheckCircle,
    Loader2,
} from 'lucide-react'
import React, { useState, useEffect } from 'react'

const VercelIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M24 22.525H0L12 1.745L24 22.525Z" />
    </svg>
)

import { GeneralTab } from './GeneralTab'
import { PublishTab } from './PublishTab'
import { BigModalOverlay, PremiumInput } from './SettingsFormControls'
import { ShareTab } from './ShareTab'

import { toProjectSlug } from '@/app/types'
import { profileAPI, type Profile } from '@/features/profile/api/profile'
import { projectAPI } from '@/features/projects/api/project'
import { ProjectDeleteModal } from '@/features/projects/components/ProjectDeleteModal'
import { ProjectDuplicateModal } from '@/features/projects/components/ProjectDuplicateModal'
import { ProjectShareModal } from '@/features/projects/components/ProjectShareModal'
import { API_BASE_URL } from '@/shared/api/client'

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
    const [deploying, setDeploying] = useState(false)
    const [deployed, setDeployed] = useState(false)
    const [buildLogs, setBuildLogs] = useState<string[]>([])
    const [deployError, setDeployError] = useState<string | null>(null)
    const [vercelDeploymentUrl, setVercelDeploymentUrl] = useState<string | null>(null)
    const [vercelLastDeployedAt, setVercelLastDeployedAt] = useState<string | null>(null)

    // Modals state
    const [isShareModalOpen, setIsShareModalOpen] = useState(false)
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [hasSavedChanges, setHasSavedChanges] = useState(false)

    // GitHub Integration states
    const [project, setProject] = useState<any>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [githubRepoName, setGithubRepoName] = useState('')
    const [githubIsPrivate, setGithubIsPrivate] = useState(true)
    const [isCreatingRepo, setIsCreatingRepo] = useState(false)
    const [isSyncingRepo, setIsSyncingRepo] = useState(false)
    const [githubCommitMsg, setGithubCommitMsg] = useState('feat: sync project changes')
    const [githubSyncError, setGithubSyncError] = useState<string | null>(null)
    const [githubSyncSuccess, setGithubSyncSuccess] = useState(false)

    const slugifyRepoName = (name: string) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9_.-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
    }

    const handleConnectGithub = () => {
        if (!profile) return
        window.location.href = profileAPI.getGithubConnectUrl(profile.id)
    }

    const handleConnectVercel = () => {
        if (!profile) return
        window.location.href = profileAPI.getVercelConnectUrl(profile.id)
    }

    const handleCreateGithubRepo = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!projectId || !githubRepoName.trim()) return
        setIsCreatingRepo(true)
        setGithubSyncError(null)
        try {
            const updatedProject = await profileAPI.createGithubRepo(projectId, {
                name: githubRepoName.trim(),
                private: githubIsPrivate,
                description: `December project - ${projName}`,
            })
            setProject(updatedProject)
            setGithubSyncSuccess(true)
            setTimeout(() => setGithubSyncSuccess(false), 3000)
        } catch (err: any) {
            setGithubSyncError(err.message || 'Failed to create GitHub repository')
        } finally {
            setIsCreatingRepo(false)
        }
    }

    const handleSyncGithubRepo = async () => {
        if (!projectId) return
        setIsSyncingRepo(true)
        setGithubSyncError(null)
        try {
            const updatedProject = await profileAPI.syncGithubRepo(projectId, {
                commitMessage: githubCommitMsg,
            })
            setProject(updatedProject)
            setGithubSyncSuccess(true)
            setTimeout(() => setGithubSyncSuccess(false), 3000)
        } catch (err: any) {
            setGithubSyncError(err.message || 'Failed to sync with GitHub')
        } finally {
            setIsSyncingRepo(false)
        }
    }

    const handleDeploy = async () => {
        if (!projectId) return
        setDeploying(true)
        setDeployed(false)
        setDeployError(null)
        setBuildLogs([])

        try {
            setBuildLogs((prev) => [
                ...prev,
                '[system] Preparing repository and auto-deployment...',
            ])

            const result = await projectAPI.deployToVercel(projectId)
            const { deploymentId, url } = result

            setBuildLogs((prev) => [
                ...prev,
                `[system] Auto-deployment triggered (ID: ${deploymentId})...`,
            ])

            // Establish Server-Sent Events connection for logs
            const logsUrl = `${API_BASE_URL}/platform/deployments/${deploymentId}/logs`
            const eventSource = new EventSource(logsUrl, { withCredentials: true })

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    if (data.type === 'stdout' || data.type === 'stderr') {
                        const line = data.payload.text
                        setBuildLogs((prev) => [...prev, line.trim()])
                    } else if (data.type === 'error') {
                        setBuildLogs((prev) => [...prev, `❌ Error: ${data.payload.text}`])
                        setDeployError(data.payload.text)
                    }
                } catch (e) {
                    setBuildLogs((prev) => [...prev, event.data])
                }
            }

            eventSource.onerror = (err) => {
                console.error('Logs EventSource error:', err)
                eventSource.close()
            }

            // Poll deployment status
            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await projectAPI.getVercelDeploymentStatus(deploymentId)
                    const { readyState, url: deploymentUrl } = statusRes

                    if (readyState === 'READY') {
                        clearInterval(pollInterval)
                        eventSource.close()
                        setDeploying(false)
                        setDeployed(true)
                        setVercelDeploymentUrl(deploymentUrl)
                        setVercelLastDeployedAt(new Date().toISOString())
                        setBuildLogs((prev) => [
                            ...prev,
                            `🎉 Deployment ready! Live at: https://${deploymentUrl}`,
                        ])
                    } else if (readyState === 'ERROR' || readyState === 'CANCELED') {
                        clearInterval(pollInterval)
                        eventSource.close()
                        setDeploying(false)
                        setDeployError(`Deployment failed with status: ${readyState}`)
                        setBuildLogs((prev) => [...prev, `❌ Vercel build failed (${readyState}).`])
                    }
                } catch (err: any) {
                    console.error('Error polling status:', err)
                    clearInterval(pollInterval)
                    eventSource.close()
                    setDeploying(false)
                    setDeployError(err.message || 'Error tracking deployment')
                }
            }, 3000)
        } catch (err: any) {
            setDeploying(false)
            setDeployError(err.message || 'Failed to trigger Vercel deployment')
            setBuildLogs((prev) => [...prev, `❌ Error: ${err.message || 'Failed to deploy'}`])
        }
    }

    // Fetch and Save states
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isDuplicating, setIsDuplicating] = useState(false)

    // Fetch profile and project details
    useEffect(() => {
        profileAPI
            .getProfile()
            .then((res) => {
                setProfile(res)
            })
            .catch((err) => console.error('Failed to load profile:', err))
    }, [])

    useEffect(() => {
        if (!projectId) return
        setIsLoading(true)
        projectAPI
            .getProject(projectId)
            .then((res) => {
                if (res?.project) {
                    setProject(res.project)
                    setProjName(res.project.name)
                    setProjDesc(res.project.description ?? '')
                    setIsFavorite(res.project.isStarred)
                    setIsTemplate(res.project.isSharedAsTemplate)
                    setCategory((res.project as any).projectCategory ?? 'NONE')
                    setGithubRepoName(slugifyRepoName(res.project.name))
                    setGithubIsPrivate(true)
                    setVercelDeploymentUrl(res.project.vercelDeploymentUrl ?? null)
                    setVercelLastDeployedAt(res.project.vercelLastDeployedAt ?? null)
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
            setHasSavedChanges(true)
        } catch (err) {
            console.error('Failed to save project settings:', err)
        } finally {
            setIsSaving(false)
        }
    }

    const handleClose = () => {
        if (hasSavedChanges) {
            if (window.location.pathname.startsWith('/project/')) {
                const slug = toProjectSlug(projName)
                window.location.href = `/project/${slug}`
            } else {
                window.location.reload()
            }
        } else {
            onClose()
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
        { id: 'integrations', label: 'GitHub', icon: <Github size={15} /> },
        { id: 'publish', label: 'Vercel', icon: <VercelIcon className="w-[15px] h-[15px]" /> },
        { id: 'share', label: 'Publish', icon: <Cloud size={15} /> },
        { id: 'variables', label: 'Env Variables', icon: <Terminal size={15} /> },
    ]

    return (
        <BigModalOverlay
            title="Project Settings"
            icon={<Settings size={16} />}
            onClose={handleClose}
        >
            {/* Sidebar */}
            <div className="w-[220px] shrink-0 border-r border-[#242323] flex flex-col py-4 bg-[#171615]">
                <div className="px-4 mb-6">
                    <button
                        type="button"
                        onClick={handleClose}
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
            <div className="flex-1 flex flex-col min-w-0 h-full bg-[#171615] relative">
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

                            {activeTab === 'publish' && (
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
                                    <h1 className="text-[16px] font-medium mb-3">
                                        GitHub Integration
                                    </h1>
                                    <div className="flex flex-col border-t border-[#242323] pt-6 w-full">
                                        {/* GitHub Connection States */}
                                        {!profile ? (
                                            <div className="text-[13px] text-[#7B7A79] text-left">
                                                Loading integration details...
                                            </div>
                                        ) : !profile.githubConnected ? (
                                            <div className="border border-dashed border-[#383736] rounded-xl py-14 flex flex-col items-center justify-center gap-4 bg-[#100E12]/30 hover:border-[#4A4948] transition-colors w-full">
                                                <div className="w-14 h-14 rounded-2xl bg-[#1E1D1B] border border-[#383736] flex items-center justify-center shadow-md">
                                                    <Github className="w-7 h-7 text-[#D6D5C9]" />
                                                </div>
                                                <div className="flex flex-col items-center gap-1.5 text-center px-4">
                                                    <span className="text-[15px] font-semibold text-[#D6D5C9]">
                                                        Connect GitHub to link repository
                                                    </span>
                                                    <span className="text-[13px] text-[#7B7A79] max-w-[360px]">
                                                        Link a GitHub repository to this project to
                                                        export and sync your generated code
                                                        automatically.
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleConnectGithub}
                                                    className="flex items-center gap-2 px-5 py-2 rounded-lg border border-[#383736] bg-[#171615] hover:bg-[#1E1D1B] text-[13px] font-medium text-[#D6D5C9] hover:text-white transition-all cursor-pointer mt-1"
                                                >
                                                    <Github className="w-4 h-4" />
                                                    Connect GitHub
                                                </button>
                                            </div>
                                        ) : project && !project.githubRepoName ? (
                                            <div className="flex flex-col w-full animate-in fade-in duration-200">
                                                <div className="flex items-center gap-4 mb-6 text-left">
                                                    <div className="w-10 h-10 rounded-lg bg-[#1E1D1B] border border-[#383736] flex items-center justify-center shrink-0">
                                                        <Github className="w-5 h-5 text-[#D6D5C9]" />
                                                    </div>
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[14px] font-medium text-[#D6D5C9]">
                                                            GitHub
                                                        </span>
                                                        <span className="text-[13px] text-[#7B7A79]">
                                                            Link a GitHub repository to this project
                                                            to export and sync your generated code
                                                            automatically.
                                                        </span>
                                                    </div>
                                                </div>

                                                <form
                                                    onSubmit={handleCreateGithubRepo}
                                                    className="flex flex-col gap-5 w-full"
                                                >
                                                    <div className="flex flex-col gap-1.5 text-left">
                                                        <label className="text-[13px] font-medium text-[#7B7A79]">
                                                            Repository Name
                                                        </label>
                                                        <div className="flex items-center bg-[#1A1918] border border-[#2B2A29] rounded-xl px-3.5 py-2.5 focus-within:border-[#4A4948] transition-colors w-full">
                                                            <span className="text-[13px] text-[#7B7A79] mr-1 select-none font-medium">
                                                                {profile.githubUsername}/
                                                            </span>
                                                            <input
                                                                type="text"
                                                                value={githubRepoName}
                                                                onChange={(e) =>
                                                                    setGithubRepoName(
                                                                        slugifyRepoName(
                                                                            e.target.value
                                                                        )
                                                                    )
                                                                }
                                                                placeholder="my-awesome-project"
                                                                className="flex-1 bg-transparent text-[13px] text-[#D6D5C9] outline-none border-none p-0 placeholder-[#555453]"
                                                                required
                                                            />
                                                        </div>
                                                    </div>

                                                    <div
                                                        onClick={() =>
                                                            setGithubIsPrivate(!githubIsPrivate)
                                                        }
                                                        className="flex items-start gap-3 bg-[#1A1918] border border-[#2B2A29] p-4 rounded-xl hover:border-[#383736] transition-colors cursor-pointer select-none w-full"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            id="private-repo"
                                                            checked={githubIsPrivate}
                                                            onChange={(e) => {
                                                                e.stopPropagation()
                                                                setGithubIsPrivate(e.target.checked)
                                                            }}
                                                            className="w-4 h-4 rounded border-[#383736] bg-[#100E12] text-[#D6D5C9] focus:ring-0 focus:ring-offset-0 cursor-pointer mt-0.5 accent-[#D6D5C9]"
                                                        />
                                                        <div className="flex flex-col text-left">
                                                            <label
                                                                htmlFor="private-repo"
                                                                className="text-[13px] font-semibold text-[#D6D5C9] cursor-pointer"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                Private Repository
                                                            </label>
                                                            <span className="text-[12.5px] text-[#7B7A79] mt-0.5">
                                                                Only you and invited collaborators
                                                                can view this repository.
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {githubSyncError && (
                                                        <div className="text-[12.5px] text-red-400 bg-red-950/20 border border-red-900/30 px-3.5 py-2.5 rounded-xl text-left w-full">
                                                            {githubSyncError}
                                                        </div>
                                                    )}

                                                    <button
                                                        type="submit"
                                                        disabled={
                                                            isCreatingRepo || !githubRepoName.trim()
                                                        }
                                                        className="w-fit flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#E8E7E4] text-[#171615] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-[13px] font-semibold transition-colors cursor-pointer"
                                                    >
                                                        {isCreatingRepo ? (
                                                            <>
                                                                <Loader2 className="w-4 h-4 animate-spin text-[#171615]" />
                                                                Creating...
                                                            </>
                                                        ) : (
                                                            'Create & Sync'
                                                        )}
                                                    </button>
                                                </form>
                                            </div>
                                        ) : project ? (
                                            <div className="flex flex-col w-full animate-in fade-in duration-200">
                                                <div className="flex items-center justify-between mb-6 w-full">
                                                    <div className="flex items-center gap-4 text-left font-medium">
                                                        <div className="w-10 h-10 rounded-lg bg-[#1E1D1B] border border-[#383736] flex items-center justify-center shrink-0">
                                                            <Github className="w-5 h-5 text-[#D6D5C9]" />
                                                        </div>
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-[14px] font-medium text-[#D6D5C9]">
                                                                GitHub
                                                            </span>
                                                            <span className="text-[13px] text-[#7B7A79]">
                                                                Export and sync your generated code
                                                                automatically.
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="text-[11px] font-medium px-2 py-0.5 rounded border border-[#2B2A29] bg-[#1E1D1B] text-[#D6D5C9]">
                                                        Active
                                                    </span>
                                                </div>

                                                <div className="bg-[#1A1918] border border-[#2B2A29] p-5 rounded-xl flex flex-col gap-4 text-left mb-6 w-full">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[12px] text-[#7B7A79] font-medium uppercase tracking-[0.05em]">
                                                            Linked Repository
                                                        </span>
                                                        {githubIsPrivate ? (
                                                            <span className="flex items-center gap-1 px-2 py-0.5 rounded border border-[#2B2A29] bg-[#1E1D1B] text-[11px] text-[#7B7A79]">
                                                                <Lock className="w-3 h-3" />
                                                                Private
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1 px-2 py-0.5 rounded border border-[#2B2A29] bg-[#1E1D1B] text-[11px] text-[#7B7A79]">
                                                                <Globe className="w-3 h-3" />
                                                                Public
                                                            </span>
                                                        )}
                                                    </div>

                                                    <a
                                                        href={
                                                            project.githubRepoUrl ??
                                                            `https://github.com/${project.githubRepoOwner}/${project.githubRepoName}`
                                                        }
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 text-[15px] font-semibold text-[#D6D5C9] hover:text-white hover:underline w-fit transition-colors"
                                                    >
                                                        <Github className="w-4 h-4 text-[#7B7A79]" />
                                                        {project.githubRepoOwner}/
                                                        {project.githubRepoName}
                                                        <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                                                    </a>

                                                    <div className="text-[12px] text-[#7B7A79] border-t border-[#242323] pt-3 flex justify-between items-center mt-1">
                                                        <span>Last Synced</span>
                                                        <span className="font-medium text-[#D6D5C9]">
                                                            {project.githubLastSyncedAt
                                                                ? new Date(
                                                                      project.githubLastSyncedAt
                                                                  ).toLocaleString()
                                                                : 'Never'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-4 w-full">
                                                    <div className="flex flex-col gap-1.5 text-left w-full">
                                                        <label className="text-[13px] font-medium text-[#7B7A79]">
                                                            Commit Message
                                                        </label>
                                                        <PremiumInput
                                                            value={githubCommitMsg}
                                                            onChange={(e) =>
                                                                setGithubCommitMsg(e.target.value)
                                                            }
                                                            placeholder="feat: sync project changes"
                                                        />
                                                    </div>

                                                    {githubSyncError && (
                                                        <div className="text-[12.5px] text-red-400 bg-red-950/20 border border-red-900/30 px-3.5 py-2.5 rounded-xl text-left w-full">
                                                            {githubSyncError}
                                                        </div>
                                                    )}

                                                    {githubSyncSuccess && (
                                                        <div className="text-[12.5px] text-[#D6D5C9] bg-[#1E1D1B] border border-[#383736] px-3.5 py-2.5 rounded-xl flex items-center gap-2 text-left w-full">
                                                            <CheckCircle className="w-4 h-4 shrink-0 text-[#7B7A79]" />
                                                            Latest changes pushed successfully!
                                                        </div>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={handleSyncGithubRepo}
                                                        disabled={isSyncingRepo}
                                                        className="w-fit flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#E8E7E4] text-[#171615] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-[13px] font-semibold transition-colors cursor-pointer"
                                                    >
                                                        {isSyncingRepo ? (
                                                            <>
                                                                <Loader2 className="w-4 h-4 animate-spin text-[#171615]" />
                                                                Pushing...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Github className="w-4 h-4 text-[#171615]" />
                                                                Push Changes
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-[13px] text-[#7B7A79] text-left">
                                                Loading integration details...
                                            </div>
                                        )}
                                    </div>
                                </div>
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
