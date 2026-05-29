import {
    Download,
    Settings,
    X,
    Copy,
    Check,
    Globe,
    Lock,
    Users,
    Rocket,
    Sliders,
    Brain,
    SlidersHorizontal,
    BarChart3,
    AlertOctagon,
    Terminal,
    RefreshCw,
    Shield,
    History,
    Settings2,
    CheckCircle2,
    UserPlus,
    Plus,
    Trash2,
    ChevronLeft,
    ChevronDown,
    Plug,
    Share,
    Cloud,
    Activity,
} from 'lucide-react'
import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

import { ProjectShareModal } from '@/features/projects/components/ProjectShareModal'
import { ProjectDuplicateModal } from '@/features/projects/components/ProjectDuplicateModal'
import { ProjectDeleteModal } from '@/features/projects/components/ProjectDeleteModal'

import { projectAPI, type BackendProjectVersionSummary } from '@/features/projects/api/project'

import { Button } from '@/shared/components/ui/Button'

interface OutputHeaderActionsProps {
    projectName?: string | null
    versions?: BackendProjectVersionSummary[]
    activeVersionId?: string | null
    isVersionLoading?: boolean
    onSelectVersion?: (versionId: string) => void
    onDownload?: () => void
}

// ─── Modal Overlay Base Layout ──────────────────────────────────────────────
interface BigModalProps {
    title: string
    icon: React.ReactNode
    onClose: () => void
    children: React.ReactNode
}

const BigModalOverlay: React.FC<BigModalProps> = ({ title, icon, onClose, children }) => {
    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative w-full max-w-[1000px] h-[85vh] md:h-[80vh] bg-[#171615] rounded-2xl border border-[#242323] flex overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 text-left">
                {children}
            </div>
        </div>,
        document.body
    )
}

// ─── Input & Toggle Helpers ──────────────────────────────────────────────────
const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#7B7A79] mb-1.5 select-none">
        {children}
    </label>
)

const PremiumInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
    className = '',
    ...props
}) => (
    <input
        {...props}
        className={`w-full bg-[#1A1918] border border-[#2B2A29] rounded-xl px-3.5 py-2 text-[13px] text-[#D6D5C9] placeholder-[#555453] outline-none focus:border-[#4A4948] transition-colors ${className}`}
    />
)

const PremiumTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
    className = '',
    ...props
}) => (
    <textarea
        {...props}
        className={`w-full bg-[#1A1918] border border-[#2B2A29] rounded-xl px-3.5 py-2.5 text-[13px] text-[#D6D5C9] placeholder-[#555453] outline-none focus:border-[#4A4948] transition-colors resize-none ${className}`}
    />
)

const PremiumToggle: React.FC<{ active: boolean; onChange: () => void }> = ({
    active,
    onChange,
}) => (
    <button
        role="switch"
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none outline-none ${
            active ? 'bg-[#242323]' : 'bg-[#100E12] border-[#383736]'
        }`}
    >
        <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                active ? 'translate-x-4 bg-[#D6D5C9]' : 'translate-x-0 bg-[#383736]'
            }`}
        />
    </button>
)

// ─────────────────────────────────────────────────────────────────────────────
// ⚙️ Combined Settings Big Modal Component
// ─────────────────────────────────────────────────────────────────────────────
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

const CATEGORIES = [
    { id: 'NONE', label: 'Select Category...' },
    { id: 'LANDING_PAGE', label: 'Landing Page' },
    { id: 'DASHBOARD', label: 'Dashboard' },
    { id: 'PORTFOLIO_BLOG', label: 'Portfolio / Blog' },
    { id: 'SAAS_APP', label: 'SaaS Application' },
    { id: 'ECOMMERCE', label: 'E-Commerce' },
]

const SettingsBigModal: React.FC<SettingsModalProps> = ({
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

    // Category dropdown state
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
    const categoryDropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                categoryDropdownRef.current &&
                !categoryDropdownRef.current.contains(event.target as Node)
            ) {
                setIsCategoryDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

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
                        onClick={onClose}
                        className="flex items-center text-[#7B7A79] hover:text-[#D6D5D4] hover:bg-[#1E1D1B] px-2 py-1 -ml-2 rounded-lg text-[13px] font-medium transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Project
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-[2px] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#383736]/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                    <div className="px-3 py-2 text-[12px] font-medium text-[#7B7A79] mb-1 select-none">
                        Settings
                    </div>
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id as any)}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors text-left outline-none w-full ${
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
                {/* Header Actions - Divider Line Removed */}
                <div className="h-14 flex items-center justify-end px-5 shrink-0">
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-[#7B7A79] hover:text-[#D6D5D4] hover:bg-white/5 transition-colors outline-none"
                    >
                        <X size={15} />
                    </button>
                </div>
                {/* Content Area */}
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-[12px] [&::-webkit-scrollbar-track]:bg-[#171615] [&::-webkit-scrollbar-thumb]:bg-[#383736] [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb]:border-[4px] [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#4A4948]">
                    <div className="w-full flex justify-center px-8 md:px-16 py-8 md:py-12 relative z-10">
                        {isLoading ? (
                            <div className="text-center py-20 text-[#7B7A79] text-sm animate-pulse">
                                Loading project details...
                            </div>
                        ) : (
                            activeTab === 'general' && (
                                <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in slide-in-from-bottom-1 duration-150">
                                    <h1 className="text-[16px] font-medium mb-3">
                                        General Settings
                                    </h1>
                                    <div className="flex flex-col gap-6 border-t border-[#242323] pt-6">
                                        <div className="flex flex-col gap-1.5 text-left">
                                            <span className="text-[14px] text-[#D6D5C9]">
                                                Project Name
                                            </span>
                                            <span className="text-[13px] text-[#7B7A79] mb-1">
                                                Change your project name display title.
                                            </span>
                                            <PremiumInput
                                                value={projName}
                                                onChange={(e) => setProjName(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1 text-left">
                                            <span className="text-[14px] text-[#D6D5C9]">
                                                Description
                                            </span>
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
                                        <div
                                            className="flex flex-col gap-1.5 text-left"
                                            ref={categoryDropdownRef}
                                        >
                                            <span className="text-[14px] text-[#D6D5C9]">
                                                Project Category
                                            </span>
                                            <span className="text-[13px] text-[#7B7A79] mb-1">
                                                Select project layout classification category.
                                            </span>
                                            <div className="relative w-full">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setIsCategoryDropdownOpen(
                                                            !isCategoryDropdownOpen
                                                        )
                                                    }
                                                    className="w-full flex items-center justify-between bg-[#1A1918] border border-[#2B2A29] hover:border-[#383736] rounded-xl px-3.5 py-2.5 text-white text-[13px] transition-[border-color,background-color] duration-200 focus:outline-none text-left"
                                                >
                                                    <span
                                                        className={
                                                            category === 'NONE'
                                                                ? 'text-[#7B7A79]'
                                                                : 'text-[#D6D5C9]'
                                                        }
                                                    >
                                                        {CATEGORIES.find(
                                                            (cat) => cat.id === category
                                                        )?.label ?? 'Select Category...'}
                                                    </span>
                                                    <ChevronDown
                                                        className={`w-4 h-4 text-[#7B7A79] transition-transform duration-200 ${
                                                            isCategoryDropdownOpen
                                                                ? 'rotate-180'
                                                                : ''
                                                        }`}
                                                    />
                                                </button>

                                                <AnimatePresence>
                                                    {isCategoryDropdownOpen && (
                                                        <motion.div
                                                            initial={{
                                                                opacity: 0,
                                                                y: -6,
                                                                scale: 0.98,
                                                            }}
                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                            exit={{
                                                                opacity: 0,
                                                                y: -6,
                                                                scale: 0.98,
                                                            }}
                                                            transition={{ duration: 0.15 }}
                                                            className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-[#383736] bg-[#1E1D1C] py-2 shadow-2xl z-50 max-h-[220px] overflow-y-auto [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#383736]/60 [&::-webkit-scrollbar-thumb]:rounded-full text-left"
                                                        >
                                                            {CATEGORIES.map((cat) => (
                                                                <button
                                                                    key={cat.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setCategory(cat.id as any)
                                                                        setIsCategoryDropdownOpen(
                                                                            false
                                                                        )
                                                                    }}
                                                                    className="w-full flex items-center justify-between px-3.5 py-2 text-[13px] text-[#D6D5C9] hover:bg-[#242323] hover:text-white transition-colors text-left"
                                                                >
                                                                    <span
                                                                        className={
                                                                            cat.id === 'NONE'
                                                                                ? 'text-[#7B7A79]'
                                                                                : ''
                                                                        }
                                                                    >
                                                                        {cat.label}
                                                                    </span>
                                                                    {category === cat.id && (
                                                                        <Check className="h-3.5 w-3.5 text-[#D6D5C9]" />
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>

                                        {/* Star / Favourite Row */}
                                        <div className="flex items-center justify-between border-t border-[#242323] pt-6">
                                            <div className="flex flex-col gap-0.5 text-left">
                                                <span className="text-[14px] text-[#D6D5C9]">
                                                    Add to Favourites
                                                </span>
                                                <span className="text-[13px] text-[#7B7A79]">
                                                    Star this project to make it easily accessible
                                                    from home.
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
                                                    {isTemplate
                                                        ? 'Unshare as Template'
                                                        : 'Share as Template'}
                                                </span>
                                                <span className="text-[13px] text-[#7B7A79]">
                                                    Allow others to duplicate this project as a
                                                    community layout.
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setIsShareModalOpen(true)}
                                                className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors font-medium"
                                            >
                                                {isTemplate ? 'Unshare' : 'Share'}
                                            </button>
                                        </div>

                                        {/* Duplicate Project Row */}
                                        <div className="flex items-center justify-between border-t border-[#242323] pt-6">
                                            <div className="flex flex-col gap-0.5 text-left">
                                                <span className="text-[14px] text-[#D6D5C9]">
                                                    Duplicate Project
                                                </span>
                                                <span className="text-[13px] text-[#7B7A79]">
                                                    Create a cloned copy of this visual project
                                                    workspace.
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setIsDuplicateModalOpen(true)}
                                                className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors font-medium"
                                            >
                                                Duplicate
                                            </button>
                                        </div>

                                        {/* Delete Project Row */}
                                        <div className="flex items-center justify-between border-t border-[#242323] pt-6">
                                            <div className="flex flex-col gap-0.5 text-left">
                                                <span className="text-[14px] text-[#EF4444]">
                                                    Delete Project
                                                </span>
                                                <span className="text-[13px] text-[#7B7A79]">
                                                    Permanently delete this project from your
                                                    workspace.
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setIsDeleteModalOpen(true)}
                                                className="px-4 py-1.5 rounded-lg border border-red-900/30 bg-red-950/20 text-[#FF8A8A] hover:bg-red-900/30 transition-colors font-medium"
                                            >
                                                Delete
                                            </button>
                                        </div>

                                        <div className="pt-4 border-t border-[#242323] flex justify-start">
                                            <button
                                                onClick={handleSaveChanges}
                                                disabled={isSaving}
                                                className="px-4 py-1.5 rounded-lg bg-[#E8E7E4] text-[#171615] hover:bg-white font-medium text-[13px] transition-colors disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {isSaving ? 'Saving...' : 'Save Changes'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        )}

                        {activeTab === 'publish' && (
                            <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in slide-in-from-bottom-1 duration-150">
                                <h1 className="text-[16px] font-medium mb-3">
                                    Publish Application
                                </h1>
                                <div className="flex flex-col gap-6 border-t border-[#242323] pt-6">
                                    {/* Environment Branch Select */}
                                    <div className="flex flex-col gap-3 text-left">
                                        <span className="text-[14px] font-medium text-[#D6D5C9]">
                                            Target Environment
                                        </span>
                                        <span className="text-[13px] text-[#7B7A79]">
                                            Select the deployment target environment branch.
                                        </span>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                {
                                                    id: 'preview',
                                                    label: 'Preview',
                                                    desc: 'Temporary developer test branch',
                                                },
                                                {
                                                    id: 'staging',
                                                    label: 'Staging',
                                                    desc: 'Pre-production QA sandbox',
                                                },
                                                {
                                                    id: 'production',
                                                    label: 'Production',
                                                    desc: 'Live public application',
                                                },
                                            ].map((item) => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => setEnv(item.id)}
                                                    className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-colors outline-none ${
                                                        env === item.id
                                                            ? 'bg-[#242323] border-[#383736] text-[#D6D5C9]'
                                                            : 'bg-[#1A1918] border-[#2B2A29] text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#1E1D1B]'
                                                    }`}
                                                >
                                                    <span className="font-semibold text-[13px] capitalize">
                                                        {item.label}
                                                    </span>
                                                    <span className="text-[11px] opacity-75">
                                                        {item.desc}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Deployment Controls */}
                                    <div className="flex flex-col gap-3 border-t border-[#242323] pt-6 text-left">
                                        <span className="text-[14px] font-medium text-[#D6D5C9]">
                                            Production Deployment
                                        </span>
                                        <span className="text-[13px] text-[#7B7A79]">
                                            Deploy the active visual workspace to the live global
                                            edge sandbox.
                                        </span>
                                        <div className="p-6 rounded-xl border border-[#242323] bg-[#1A1918]/20 flex flex-col items-center justify-center text-center space-y-4">
                                            <Rocket
                                                className="w-12 h-12 text-[#7B7A79]"
                                                strokeWidth={1.5}
                                            />
                                            <div className="space-y-1">
                                                <span className="block text-[14px] font-semibold text-white">
                                                    Deploy Live Application
                                                </span>
                                                <span className="block text-xs text-[#7B7A79] max-w-[400px]">
                                                    Compile the active visual workspace, bundle
                                                    files, and push them globally.
                                                </span>
                                            </div>
                                            <button
                                                onClick={handleDeploy}
                                                disabled={deploying || deployed}
                                                className={`rounded-lg px-5 py-2 text-[13px] font-semibold transition-colors outline-none ${
                                                    deployed
                                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                        : deploying
                                                          ? 'bg-[#242323] border border-[#383736] text-[#7B7A79] cursor-not-allowed'
                                                          : 'bg-[#E8E7E4] text-[#171615] hover:bg-white'
                                                }`}
                                            >
                                                {deploying ? (
                                                    <span className="flex items-center gap-1.5 justify-center">
                                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                        <span>Bundling Assets...</span>
                                                    </span>
                                                ) : deployed ? (
                                                    <span className="flex items-center gap-1.5 justify-center">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        <span>Deployed Successfully!</span>
                                                    </span>
                                                ) : (
                                                    'Deploy to Production'
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Domain Settings */}
                                    <div className="flex flex-col gap-4 border-t border-[#242323] pt-6 text-left">
                                        <span className="text-[14px] font-medium text-[#D6D5C9]">
                                            Domain Configuration
                                        </span>
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[13px] text-[#7B7A79]">
                                                Your free default system subdomain.
                                            </span>
                                            <div className="flex gap-2 items-center">
                                                <PremiumInput
                                                    value={subDomain}
                                                    onChange={(e) => setSubDomain(e.target.value)}
                                                    className="flex-1"
                                                />
                                                <span className="text-[13px] text-[#7B7A79] font-mono">
                                                    .december.dev
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[13px] text-[#7B7A79]">
                                                Point your own branded domain name to this build.
                                            </span>
                                            <PremiumInput
                                                value={customDomain}
                                                onChange={(e) => setCustomDomain(e.target.value)}
                                                placeholder="www.my-awesome-app.com"
                                            />
                                        </div>
                                    </div>

                                    {/* Protection Settings */}
                                    <div className="flex flex-col gap-4 border-t border-[#242323] pt-6 text-left">
                                        <span className="text-[14px] font-medium text-[#D6D5C9]">
                                            Access Protection
                                        </span>
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[13px] text-[#D6D5C9]">
                                                    Password Protection
                                                </span>
                                                <span className="text-[12px] text-[#7B7A79]">
                                                    Require visitors to input a password to view
                                                    this staging/preview deploy.
                                                </span>
                                            </div>
                                            <PremiumToggle
                                                active={pwdProtection}
                                                onChange={() => setPwdProtection(!pwdProtection)}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[13px] text-[#D6D5C9]">
                                                    Block Search Indexing
                                                </span>
                                                <span className="text-[12px] text-[#7B7A79]">
                                                    Instruct crawlers and search engines to ignore
                                                    this deployment.
                                                </span>
                                            </div>
                                            <PremiumToggle
                                                active={noIndex}
                                                onChange={() => setNoIndex(!noIndex)}
                                            />
                                        </div>
                                    </div>

                                    {/* Build Logs Console & History */}
                                    <div className="flex flex-col gap-4 border-t border-[#242323] pt-6 text-left">
                                        <span className="text-[14px] font-medium text-[#D6D5C9]">
                                            Terminal Build Logs & History
                                        </span>
                                        <div className="h-44 bg-[#100E12] rounded-xl border border-[#2B2A29] p-4 font-mono text-[11px] text-green-400 overflow-y-auto space-y-1 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#383736]/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                                            <div className="text-neutral-500">
                                                [12:02:11] $ bun run build.ts
                                            </div>
                                            <div>[12:02:12] 🚀 Starting compile loops...</div>
                                            <div>[12:02:13] 🗑️ Cleaning dist cache folder...</div>
                                            <div>
                                                [12:02:15] 📄 Processing components index
                                                mappings...
                                            </div>
                                            <div>
                                                [12:02:18] 📦 Bundling 4 JSX modules (vite v5.2)...
                                            </div>
                                            <div>
                                                [12:02:22] ✅ Assets generated: chunk-xbhnt5se.js
                                                (1.30 MB)
                                            </div>
                                            <div className="text-emerald-400 animate-pulse font-bold">
                                                [12:02:24] ✅ Deploying to edge... Ready!
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-xl border border-[#2B2A29] bg-[#1A1918]/20 flex items-center justify-between text-[12.5px]">
                                            <div className="space-y-0.5">
                                                <span className="block text-[#D6D5C9] font-semibold">
                                                    Last Active Deployment
                                                </span>
                                                <span className="block text-xs text-[#7B7A79] font-mono">
                                                    Build ID: dep_xbh726e • 5 minutes ago
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase bg-green-950/40 border border-green-900/30 text-green-400 rounded-xl px-2.5 py-0.5 select-none flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                Success
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'share' && (
                            <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in slide-in-from-bottom-1 duration-150">
                                <h1 className="text-[16px] font-medium mb-3">Share</h1>
                                <div className="flex flex-col gap-6 border-t border-[#242323] pt-6">
                                    {/* Visibility Cards */}
                                    <div className="flex flex-col gap-3 text-left">
                                        <span className="text-[14px] font-medium text-[#D6D5C9]">
                                            Visibility
                                        </span>
                                        <span className="text-[13px] text-[#7B7A79]">
                                            Configure who can see and duplicate this workspace
                                            template.
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
                                                    key={opt.id}
                                                    onClick={() => setVisibility(opt.id as any)}
                                                    className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-colors outline-none ${
                                                        visibility === opt.id
                                                            ? 'bg-[#242323] border-[#383736] text-[#D6D5C9]'
                                                            : 'bg-[#1A1918] border-[#2B2A29] text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#1E1D1B]'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 font-semibold text-[13px]">
                                                        {opt.icon}
                                                        <span>{opt.label}</span>
                                                    </div>
                                                    <span className="text-[11px] opacity-75">
                                                        {opt.desc}
                                                    </span>
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
                                                className="bg-[#1A1918] border border-[#2B2A29] rounded-xl px-3.5 py-2 text-[13px] text-[#D6D5C9] outline-none"
                                            >
                                                <option value="view">View</option>
                                                <option value="edit">Edit</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                            <button className="px-4 py-2 border border-[#383736] rounded-lg text-[13px] font-medium text-[#D6D5C9] hover:bg-[#242323] transition-colors shadow-sm flex items-center gap-1.5 outline-none font-sans">
                                                <UserPlus size={14} />
                                                <span>Invite</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'integrations' && (
                            <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in slide-in-from-bottom-1 duration-150">
                                <h1 className="text-[16px] font-medium mb-3">Integrations</h1>
                                <div className="flex flex-col gap-6 border-t border-[#242323] pt-6">
                                    <div className="text-center py-12 text-[#7B7A79] text-[13px]">
                                        Connect third-party tools and services to sync your project
                                        workflow. (Coming Soon)
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'variables' && (
                            <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in slide-in-from-bottom-1 duration-150">
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
                            <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in slide-in-from-bottom-1 duration-150">
                                <h1 className="text-[16px] font-medium mb-3">Domains</h1>
                                <div className="flex flex-col gap-6 border-t border-[#242323] pt-6">
                                    <div className="text-center py-12 text-[#7B7A79] text-[13px]">
                                        Link a custom branded domain or configure secure subdomains.
                                        (Coming Soon)
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'analytics' && (
                            <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in slide-in-from-bottom-1 duration-150">
                                <h1 className="text-[16px] font-medium mb-3">Analytics Settings</h1>
                                <div className="flex flex-col gap-6 border-t border-[#242323] pt-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col gap-0.5 text-left">
                                            <span className="text-[14px] text-[#D6D5C9]">
                                                Enable Analytics
                                            </span>
                                            <span className="text-[13px] text-[#7B7A79]">
                                                Track compile loops, page loading cycles, and visual
                                                interactions.
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
                    </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 Publish Big Modal Component
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// ─── Main Action Controls Header Component ──────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
interface OutputHeaderActionsProps {
    projectName?: string | null
    projectId?: string | null
    versions?: BackendProjectVersionSummary[]
    activeVersionId?: string | null
    isVersionLoading?: boolean
    onSelectVersion?: (versionId: string) => void
    onDownload?: () => void
}

export const OutputHeaderActions: React.FC<OutputHeaderActionsProps> = ({
    projectName,
    projectId,
    activeVersionId,
    isVersionLoading = false,
    onDownload,
}) => {
    const isDownloadDisabled = !activeVersionId || isVersionLoading
    const [activePanel, setActivePanel] = useState<'settings' | null>(null)
    const [settingsTab, setSettingsTab] = useState<
        'general' | 'share' | 'integrations' | 'variables' | 'domains' | 'analytics' | 'publish'
    >('general')

    const openSettings = (tab: typeof settingsTab) => {
        setSettingsTab(tab)
        setActivePanel('settings')
    }

    return (
        <div className="flex items-center gap-0.5 relative">
            {/* Settings */}
            <Button
                variant="ghost"
                size="icon"
                title="Settings"
                onClick={() => openSettings('general')}
                className={`text-[#91908F] hover:text-white hidden md:flex h-8 w-8 transition-colors outline-none border-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0 ${activePanel === 'settings' && settingsTab !== 'publish' ? 'text-white bg-white/5' : ''}`}
            >
                <Settings size={16} />
            </Button>

            {/* Download */}
            <Button
                variant="ghost"
                size="icon"
                title="Download Code"
                className="text-[#91908F] hover:text-white hidden md:flex h-8 w-8 disabled:opacity-40 disabled:text-[#91908F] outline-none border-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0"
                onClick={onDownload}
                disabled={isDownloadDisabled}
            >
                <Download size={16} />
            </Button>

            {/* Publish */}
            <Button
                onClick={() => openSettings('publish')}
                className={`ml-2 bg-[#171615] hover:bg-[#1E1D1B] text-[#D6D5D4] hover:text-white border border-[#363534] rounded-xl font-medium hidden md:flex px-4 py-1.5 h-auto transition-colors outline-none border-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0 ${activePanel === 'settings' && settingsTab === 'publish' ? 'bg-[#1E1D1B] border-[#4A4948] text-white' : ''}`}
            >
                Publish
            </Button>

            {/* Big full-screen settings overlay */}
            {activePanel === 'settings' && (
                <SettingsBigModal
                    onClose={() => setActivePanel(null)}
                    initialTab={settingsTab}
                    projectName={projectName ?? 'untitled'}
                    projectId={projectId}
                />
            )}
        </div>
    )
}
