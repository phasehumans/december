import {
    Download,
    Share2,
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
} from 'lucide-react'
import React, { useState } from 'react'

import type { BackendProjectVersionSummary } from '@/features/projects/api/project'

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

const BigModalOverlay: React.FC<BigModalProps> = ({ title, icon, onClose, children }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="absolute inset-0" onClick={onClose} />
        <div className="relative w-full max-w-[1000px] h-[85vh] md:h-[80vh] bg-[#171615] rounded-2xl border border-[#242323] flex overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 text-left">
            {children}
        </div>
    </div>
)

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
        type="button"
        onClick={onChange}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 outline-none ${active ? 'bg-[#D6D5C9]' : 'bg-[#2A2928]'}`}
    >
        <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform duration-200 ${
                active ? 'translate-x-4 bg-[#171615]' : 'translate-x-0 bg-[#7B7A79]'
            }`}
        />
    </button>
)

// ─────────────────────────────────────────────────────────────────────────────
// ⚙️ Combined Settings Big Modal Component
// ─────────────────────────────────────────────────────────────────────────────
interface SettingsModalProps {
    onClose: () => void
    initialTab: 'general' | 'access' | 'ai' | 'development' | 'analytics' | 'danger'
    projectName: string
}

const SettingsBigModal: React.FC<SettingsModalProps> = ({ onClose, initialTab, projectName }) => {
    const [activeTab, setActiveTab] = useState(initialTab)
    const [projName, setProjName] = useState(projectName)
    const [projIcon, setProjIcon] = useState('✨')
    const [projDesc, setProjDesc] = useState(
        'My awesome visual-first application developed on December.'
    )
    const [visibility, setVisibility] = useState<'private' | 'link' | 'public'>('link')

    // AI state
    const [aiInstructions, setAiInstructions] = useState(
        'Maintain consistent dark theme and minimalist components. Prioritize Inter fonts and rounded margins.'
    )

    // Toggles state
    const [autoSave, setAutoSave] = useState(true)
    const [autoFix, setAutoFix] = useState(false)
    const [autoRestart, setAutoRestart] = useState(true)
    const [analytics, setAnalytics] = useState(true)

    // Collaborators mock state
    const [email, setEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('edit')
    const [collaborators, setCollaborators] = useState([
        { email: 'owner@december.dev', role: 'Owner' },
        { email: 'collab@december.dev', role: 'Admin' },
        { email: 'ai-agent@december.dev', role: 'Edit' },
    ])

    const handleAddCollab = () => {
        if (!email.trim()) return
        setCollaborators([
            ...collaborators,
            { email: email.trim(), role: inviteRole.charAt(0).toUpperCase() + inviteRole.slice(1) },
        ])
        setEmail('')
    }

    const handleRemoveCollab = (idx: number) => {
        setCollaborators(collaborators.filter((_, i) => i !== idx))
    }

    const tabs = [
        { id: 'general', label: 'General', icon: <Sliders size={15} /> },
        { id: 'access', label: 'Access & Share', icon: <Users size={15} /> },
        { id: 'ai', label: 'AI Behavior', icon: <Brain size={15} /> },
        { id: 'development', label: 'Development', icon: <SlidersHorizontal size={15} /> },
        { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={15} /> },
        { id: 'danger', label: 'Danger Zone', icon: <AlertOctagon size={15} /> },
    ]

    return (
        <BigModalOverlay title="Project Settings" icon={<Settings size={16} />} onClose={onClose}>
            {/* Sidebar */}
            <div className="w-[220px] md:w-[260px] shrink-0 border-r border-[#242323] flex flex-col py-5 bg-[#131211]/30">
                <div className="px-5 mb-6 flex items-center gap-2 select-none">
                    <Settings className="w-[18px] h-[18px] text-white" strokeWidth={2} />
                    <span className="text-[14px] font-bold tracking-wide text-white font-sans uppercase">
                        Project Settings
                    </span>
                </div>
                <div className="flex-1 overflow-y-auto px-2.5 space-y-1 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#383736]/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id as any)}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all text-left outline-none ${
                                activeTab === t.id
                                    ? 'bg-[#1E1D1B] border border-[#2B2A29] text-white shadow-sm'
                                    : 'text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#1E1D1B]/30 border border-transparent'
                            }`}
                        >
                            <span className={activeTab === t.id ? 'text-white' : 'text-[#7B7A79]'}>
                                {t.icon}
                            </span>
                            <span>{t.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Pane */}
            <div className="flex-1 flex flex-col min-w-0 h-full bg-[#171615]">
                {/* Header Actions */}
                <div className="h-14 border-b border-[#242323] flex items-center justify-end px-5 shrink-0">
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-[#7B7A79] hover:text-[#D6D5D4] hover:bg-white/5 transition-colors outline-none"
                    >
                        <X size={15} />
                    </button>
                </div>
                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-thumb]:bg-[#383736]/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                    {activeTab === 'general' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-150">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">
                                    General Settings
                                </h3>
                                <p className="text-xs text-[#7B7A79] mb-4">
                                    Update your basic project structure and display information.
                                </p>
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-3">
                                    <FieldLabel>Project Name</FieldLabel>
                                    <PremiumInput
                                        value={projName}
                                        onChange={(e) => setProjName(e.target.value)}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <FieldLabel>Icon / Emoji</FieldLabel>
                                    <PremiumInput
                                        value={projIcon}
                                        onChange={(e) => setProjIcon(e.target.value)}
                                        className="text-center font-semibold"
                                    />
                                </div>
                            </div>
                            <div>
                                <FieldLabel>Description</FieldLabel>
                                <PremiumTextarea
                                    rows={4}
                                    value={projDesc}
                                    onChange={(e) => setProjDesc(e.target.value)}
                                    placeholder="Write a brief overview of your application..."
                                />
                            </div>
                            <div className="pt-2 border-t border-[#242323] flex justify-end">
                                <button
                                    onClick={onClose}
                                    className="rounded-xl px-4 py-2 text-[13px] font-semibold text-black bg-white hover:bg-neutral-200 transition-colors"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'access' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-1 duration-150">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">
                                    Access & Share
                                </h3>
                                <p className="text-xs text-[#7B7A79] mb-4">
                                    Configure visibility presets and invite other team members.
                                </p>
                            </div>

                            {/* Visibility Cards */}
                            <div className="space-y-2">
                                <FieldLabel>Visibility</FieldLabel>
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
                                            className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all outline-none ${
                                                visibility === opt.id
                                                    ? 'bg-[#1E1D1B] border-[#4A4948] text-white'
                                                    : 'bg-[#1A1918] border-[#2B2A29] text-[#7B7A79] hover:text-[#D6D5C9]'
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
                            <div className="space-y-3 pt-3 border-t border-[#242323]">
                                <FieldLabel>Invite Collaborator</FieldLabel>
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
                                        className="bg-[#1A1918] border border-[#2B2A29] rounded-xl px-3.5 py-2 text-[13px] text-[#D6D5C9] outline-none outline-none"
                                    >
                                        <option value="view">View</option>
                                        <option value="edit">Edit</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                    <button
                                        onClick={handleAddCollab}
                                        className="rounded-xl px-4 py-2 text-[13px] font-semibold border border-[#2B2A29] hover:border-[#4A4948] text-[#D6D5D4] hover:text-white bg-[#1A1918] transition-colors flex items-center gap-1.5 outline-none"
                                    >
                                        <UserPlus size={14} />
                                        <span>Invite</span>
                                    </button>
                                </div>
                            </div>

                            {/* Manage Members */}
                            <div className="space-y-3 pt-3 border-t border-[#242323]">
                                <FieldLabel>Manage Members</FieldLabel>
                                <div className="bg-[#131211]/30 rounded-xl border border-[#242323] divide-y divide-[#242323] overflow-hidden">
                                    {collaborators.map((c, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between px-4 py-3 text-[13px]"
                                        >
                                            <span className="text-[#D6D5C9] font-mono">
                                                {c.email}
                                            </span>
                                            <div className="flex items-center gap-3">
                                                <span
                                                    className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded border ${
                                                        c.role === 'Owner'
                                                            ? 'bg-amber-950/30 border-amber-900/40 text-amber-400'
                                                            : 'bg-[#1E1D1B] border-[#2B2A29] text-[#7B7A79]'
                                                    }`}
                                                >
                                                    {c.role}
                                                </span>
                                                {c.role !== 'Owner' && (
                                                    <button
                                                        onClick={() => handleRemoveCollab(i)}
                                                        className="p-1 rounded text-[#555453] hover:text-red-400 hover:bg-white/5 transition-colors outline-none"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ai' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-150">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">
                                    AI Behavior
                                </h3>
                                <p className="text-xs text-[#7B7A79] mb-4">
                                    Set dynamic prompts, prompt constraints, and memory parameters.
                                </p>
                            </div>
                            <div>
                                <FieldLabel>Project Instructions (System Prompt)</FieldLabel>
                                <PremiumTextarea
                                    rows={5}
                                    value={aiInstructions}
                                    onChange={(e) => setAiInstructions(e.target.value)}
                                    placeholder="Write instructions that guide the AI design model..."
                                />
                            </div>

                            {/* Attached Knowledge Files */}
                            <div>
                                <FieldLabel>Attached Knowledge Files</FieldLabel>
                                <div className="border-2 border-dashed border-[#2B2A29] rounded-xl p-6 text-center space-y-2 hover:border-[#4A4948] transition-colors cursor-pointer select-none">
                                    <Brain className="w-8 h-8 mx-auto text-[#555453]" />
                                    <span className="block text-xs text-[#7B7A79]">
                                        Drag and drop context specifications here, or{' '}
                                        <span className="text-white hover:underline">
                                            browse files
                                        </span>
                                    </span>
                                    <span className="block text-[10px] text-[#555453]">
                                        Supports PDF, MD, HTML, JSON, YAML up to 10MB
                                    </span>
                                </div>
                            </div>

                            {/* Reset Memory */}
                            <div className="p-4 rounded-xl border border-amber-900/30 bg-amber-950/10 flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <span className="block text-[13px] font-semibold text-amber-500">
                                        Reset AI Memory
                                    </span>
                                    <span className="block text-xs text-[#7B7A79]">
                                        Clear the conversational cache, prompt context, and visual
                                        history memory.
                                    </span>
                                </div>
                                <button className="rounded-xl px-4 py-2 text-[12px] font-semibold border border-amber-800/40 text-amber-500 hover:bg-amber-500/10 transition-colors outline-none shrink-0">
                                    Reset Context
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'development' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-150">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">
                                    Development Options
                                </h3>
                                <p className="text-xs text-[#7B7A79] mb-4">
                                    Toggle sandbox parameters, editor tools, and diagnostic
                                    features.
                                </p>
                            </div>
                            <div className="space-y-4">
                                {[
                                    {
                                        title: 'Auto Save',
                                        desc: 'Auto save workspace files on code changes.',
                                        state: autoSave,
                                        setter: setAutoSave,
                                    },
                                    {
                                        title: 'Auto Fix Errors',
                                        desc: 'Scan and repair preview syntax exceptions.',
                                        state: autoFix,
                                        setter: setAutoFix,
                                    },
                                    {
                                        title: 'Auto Restart Sandbox',
                                        desc: 'Refresh the compiler when configurations are compiled.',
                                        state: autoRestart,
                                        setter: setAutoRestart,
                                    },
                                ].map((row, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between p-4 rounded-xl bg-[#1A1918] border border-[#2B2A29]"
                                    >
                                        <div className="space-y-1">
                                            <span className="block text-[13px] font-semibold text-white">
                                                {row.title}
                                            </span>
                                            <span className="block text-xs text-[#7B7A79]">
                                                {row.desc}
                                            </span>
                                        </div>
                                        <PremiumToggle
                                            active={row.state}
                                            onChange={() => row.setter(!row.state)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'analytics' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-150">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">
                                    Analytics Settings
                                </h3>
                                <p className="text-xs text-[#7B7A79] mb-4">
                                    Monitor execution logs, visitor behaviors, and runtime
                                    resources.
                                </p>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-[#1A1918] border border-[#2B2A29]">
                                <div className="space-y-1">
                                    <span className="block text-[13px] font-semibold text-white">
                                        Enable Analytics
                                    </span>
                                    <span className="block text-xs text-[#7B7A79]">
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
                    )}

                    {activeTab === 'danger' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-150">
                            <div>
                                <h3 className="text-lg font-semibold text-red-500 mb-1">
                                    Danger Zone
                                </h3>
                                <p className="text-xs text-[#7B7A79] mb-4">
                                    Irreversible actions that could cause build losses or delete
                                    directories.
                                </p>
                            </div>
                            <div className="rounded-xl border border-red-900/30 divide-y divide-red-900/20 bg-red-950/5 overflow-hidden">
                                {[
                                    {
                                        title: 'Duplicate Project',
                                        desc: 'Create a direct cloned instance of this workspace.',
                                        btn: 'Duplicate',
                                        red: false,
                                    },
                                    {
                                        title: 'Archive Project',
                                        desc: 'Mark this directory as read-only. Prevents accidental compiles.',
                                        btn: 'Archive',
                                        red: false,
                                    },
                                    {
                                        title: 'Delete Project',
                                        desc: 'Permanently purge this project code. This action is irreversible.',
                                        btn: 'Delete Project',
                                        red: true,
                                    },
                                ].map((row, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between p-4 gap-4"
                                    >
                                        <div className="space-y-0.5">
                                            <span className="block text-[13px] font-semibold text-white">
                                                {row.title}
                                            </span>
                                            <span className="block text-xs text-[#7B7A79]">
                                                {row.desc}
                                            </span>
                                        </div>
                                        <button
                                            className={`rounded-xl px-4 py-2 text-[12px] font-bold border transition-colors outline-none shrink-0 ${
                                                row.red
                                                    ? 'border-red-900/40 text-red-500 hover:bg-red-500/10'
                                                    : 'border-[#2B2A29] text-[#D6D5C9] hover:bg-white/5 hover:border-[#4A4948]'
                                            }`}
                                        >
                                            {row.btn}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </BigModalOverlay>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 Publish Big Modal Component
// ─────────────────────────────────────────────────────────────────────────────
interface PublishModalProps {
    onClose: () => void
}

const PublishBigModal: React.FC<PublishModalProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState('environment')
    const [env, setEnv] = useState('production')
    const [subDomain, setSubDomain] = useState('my-awesome-app')
    const [customDomain, setCustomDomain] = useState('')

    // Protection Toggles
    const [pwdProtection, setPwdProtection] = useState(false)
    const [noIndex, setNoIndex] = useState(false)

    // Deployment state
    const [deploying, setDeploying] = useState(false)
    const [deployed, setDeployed] = useState(false)

    // Variables state
    const [vars, setVars] = useState([
        { key: 'DATABASE_URL', val: 'postgresql://december:******@postgres.db:5432/main' },
        { key: 'STRIPE_SECRET_KEY', val: 'sk_live_51O2a*********************' },
    ])
    const [newKey, setNewKey] = useState('')
    const [newVal, setNewVal] = useState('')

    const handleAddVar = () => {
        if (!newKey.trim() || !newVal.trim()) return
        setVars([...vars, { key: newKey.trim().toUpperCase(), val: newVal.trim() }])
        setNewKey('')
        setNewVal('')
    }

    const handleDeleteVar = (idx: number) => {
        setVars(vars.filter((_, i) => i !== idx))
    }

    const handleDeploy = () => {
        setDeploying(true)
        setTimeout(() => {
            setDeploying(false)
            setDeployed(true)
            setTimeout(() => setDeployed(false), 3000)
        }, 1800)
    }

    const tabs = [
        { id: 'environment', label: 'Environment', icon: <SlidersHorizontal size={15} /> },
        { id: 'domain', label: 'Domain Settings', icon: <Globe size={15} /> },
        { id: 'variables', label: 'Env Variables', icon: <Shield size={15} /> },
        { id: 'deployment', label: 'Deployment Options', icon: <Rocket size={15} /> },
        { id: 'protection', label: 'Protection', icon: <Lock size={15} /> },
        { id: 'history', label: 'Deployment History', icon: <History size={15} /> },
        { id: 'advanced', label: 'Advanced Settings', icon: <Settings2 size={15} /> },
    ]

    return (
        <BigModalOverlay title="Publish Application" icon={<Rocket size={16} />} onClose={onClose}>
            {/* Sidebar */}
            <div className="w-[220px] md:w-[260px] shrink-0 border-r border-[#242323] flex flex-col py-5 bg-[#131211]/30">
                <div className="px-5 mb-5 flex items-center gap-2 select-none">
                    <Rocket className="w-[18px] h-[18px] text-white" strokeWidth={2} />
                    <span className="text-[14px] font-bold tracking-wide text-white font-sans uppercase">
                        Publish System
                    </span>
                </div>
                <div className="flex-1 overflow-y-auto px-2.5 space-y-1 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#383736]/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all text-left outline-none ${
                                activeTab === t.id
                                    ? 'bg-[#1E1D1B] border border-[#2B2A29] text-white shadow-sm'
                                    : 'text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#1E1D1B]/30 border border-transparent'
                            }`}
                        >
                            <span className={activeTab === t.id ? 'text-white' : 'text-[#7B7A79]'}>
                                {t.icon}
                            </span>
                            <span>{t.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Pane */}
            <div className="flex-1 flex flex-col min-w-0 h-full bg-[#171615]">
                {/* Header Actions */}
                <div className="h-14 border-b border-[#242323] flex items-center justify-end px-5 shrink-0">
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-[#7B7A79] hover:text-[#D6D5D4] hover:bg-white/5 transition-colors outline-none"
                    >
                        <X size={15} />
                    </button>
                </div>
                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-thumb]:bg-[#383736]/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                    {activeTab === 'environment' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-150">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">
                                    Environments
                                </h3>
                                <p className="text-xs text-[#7B7A79] mb-4">
                                    Toggle targeted deployment sandboxes for testing and live
                                    visitors.
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    {
                                        id: 'preview',
                                        label: 'Preview',
                                        status: 'Active',
                                        desc: 'Builds from active visual loops',
                                    },
                                    {
                                        id: 'staging',
                                        label: 'Staging',
                                        status: 'Setup Ready',
                                        desc: 'Internal pre-release checks',
                                    },
                                    {
                                        id: 'production',
                                        label: 'Production',
                                        status: 'Deployed Live',
                                        desc: 'Public edge deployments',
                                    },
                                ].map((o) => (
                                    <button
                                        key={o.id}
                                        onClick={() => setEnv(o.id)}
                                        className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all outline-none relative ${
                                            env === o.id
                                                ? 'bg-[#1E1D1B] border-[#4A4948] text-white'
                                                : 'bg-[#1A1918] border-[#2B2A29] text-[#7B7A79] hover:text-[#D6D5C9]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between text-[13px] font-bold">
                                            <span>{o.label}</span>
                                            <span
                                                className={`text-[9px] px-1.5 py-0.5 rounded uppercase ${
                                                    env === o.id
                                                        ? 'bg-green-950/40 text-green-400 border border-green-900/30'
                                                        : 'bg-[#2A2928] text-[#555453]'
                                                }`}
                                            >
                                                {o.status}
                                            </span>
                                        </div>
                                        <span className="text-[11px] leading-relaxed opacity-75">
                                            {o.desc}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'domain' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-150">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">
                                    Domain Settings
                                </h3>
                                <p className="text-xs text-[#7B7A79] mb-4">
                                    Route domains, add SSL mappings, and check server names.
                                </p>
                            </div>
                            <div>
                                <FieldLabel>December Subdomain</FieldLabel>
                                <div className="flex gap-2">
                                    <PremiumInput
                                        placeholder="subdomain"
                                        value={subDomain}
                                        onChange={(e) => setSubDomain(e.target.value)}
                                        className="flex-1 font-mono text-[12.5px]"
                                    />
                                    <span className="bg-[#1A1918] border border-[#2B2A29] rounded-xl px-4 py-2 text-[13px] text-[#555453] flex items-center select-none font-mono font-medium">
                                        .december.dev
                                    </span>
                                </div>
                            </div>
                            <div>
                                <FieldLabel>Custom Domain</FieldLabel>
                                <div className="flex gap-2">
                                    <PremiumInput
                                        placeholder="app.mybrand.com"
                                        value={customDomain}
                                        onChange={(e) => setCustomDomain(e.target.value)}
                                        className="flex-1 font-mono text-[12.5px]"
                                    />
                                    <span className="text-[11px] font-bold uppercase bg-amber-950/20 border border-amber-900/20 text-amber-500 rounded-xl px-3 flex items-center select-none">
                                        Pending setup
                                    </span>
                                </div>
                            </div>

                            {/* Setup Instructions */}
                            <div className="p-4 rounded-xl border border-[#2B2A29] bg-[#131211]/30 space-y-2 text-[12.5px] leading-relaxed text-[#7B7A79]">
                                <span className="block font-semibold text-[#D6D5C9]">
                                    Record Settings (DNS Details)
                                </span>
                                <span>
                                    Point your custom domain DNS server rules to these live records:
                                </span>
                                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-[#171615] border border-[#2B2A29] font-mono text-[11px] text-[#D6D5C9]">
                                    <span>Type: CNAME</span>
                                    <span>Host: @</span>
                                    <span>Target: dns.december.dev</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'variables' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-150">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">
                                    Environment Variables
                                </h3>
                                <p className="text-xs text-[#7B7A79] mb-4">
                                    Set application parameters, tokens, databases, and secure
                                    secrets.
                                </p>
                            </div>

                            {/* Add Variables */}
                            <div className="grid grid-cols-6 gap-2 pt-1.5">
                                <div className="col-span-2">
                                    <PremiumInput
                                        placeholder="KEY"
                                        value={newKey}
                                        onChange={(e) => setNewKey(e.target.value)}
                                        className="font-mono text-xs uppercase"
                                    />
                                </div>
                                <div className="col-span-3">
                                    <PremiumInput
                                        placeholder="Value (Secret)"
                                        value={newVal}
                                        onChange={(e) => setNewVal(e.target.value)}
                                        className="font-mono text-xs"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <button
                                        onClick={handleAddVar}
                                        className="w-full h-full rounded-xl border border-[#2B2A29] hover:border-[#4A4948] text-white bg-[#1A1918] hover:bg-[#1E1D1B] transition-colors flex items-center justify-center gap-1.5 outline-none font-bold text-xs"
                                    >
                                        <Plus size={14} />
                                        <span>Add</span>
                                    </button>
                                </div>
                            </div>

                            {/* Active Variables */}
                            <div className="space-y-2 pt-3 border-t border-[#242323]">
                                <FieldLabel>Manage Variables</FieldLabel>
                                <div className="bg-[#131211]/30 rounded-xl border border-[#242323] divide-y divide-[#242323] overflow-hidden">
                                    {vars.map((v, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between px-4 py-3 text-[12.5px] font-mono"
                                        >
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-white font-semibold">
                                                    {v.key}
                                                </span>
                                                <span className="text-[#555453] text-[11px] truncate max-w-[450px]">
                                                    {v.val}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteVar(i)}
                                                className="p-1.5 rounded text-[#555453] hover:text-red-400 hover:bg-white/5 transition-colors outline-none shrink-0"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'deployment' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-150">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">
                                    Deployment Options
                                </h3>
                                <p className="text-xs text-[#7B7A79] mb-4">
                                    Launch new builds, trigger compiles, and roll back code.
                                </p>
                            </div>

                            {/* Big primary CTA */}
                            <div className="p-6 rounded-xl border border-[#242323] bg-[#131211]/30 flex flex-col items-center justify-center text-center space-y-4">
                                <Rocket className="w-12 h-12 text-[#9B9A99]" strokeWidth={1.5} />
                                <div className="space-y-1">
                                    <span className="block text-[14px] font-semibold text-white">
                                        Deploy Live Application
                                    </span>
                                    <span className="block text-xs text-[#7B7A79] max-w-[400px]">
                                        Compile the active visual workspace, format packages, and
                                        deploy them across edge nodes globally.
                                    </span>
                                </div>
                                <button
                                    onClick={handleDeploy}
                                    disabled={deploying || deployed}
                                    className={`rounded-xl px-6 py-3 text-[13px] font-bold transition-all outline-none ${
                                        deployed
                                            ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-400'
                                            : deploying
                                              ? 'bg-[#1E1D1B] border border-[#2B2A29] text-[#7B7A79] cursor-wait'
                                              : 'bg-white text-black hover:bg-neutral-200 shadow-md font-extrabold'
                                    }`}
                                >
                                    {deployed
                                        ? 'Deployment Completed!'
                                        : deploying
                                          ? 'Building bundle...'
                                          : 'Deploy to Production'}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'protection' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-150">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">
                                    Security & Protection
                                </h3>
                                <p className="text-xs text-[#7B7A79] mb-4">
                                    Set password gates, bot indexing rules, and secure routes.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-xl bg-[#1A1918] border border-[#2B2A29]">
                                    <div className="space-y-1">
                                        <span className="block text-[13px] font-semibold text-white">
                                            Password Protection
                                        </span>
                                        <span className="block text-xs text-[#7B7A79]">
                                            Enforce password logins on live environments.
                                        </span>
                                    </div>
                                    <PremiumToggle
                                        active={pwdProtection}
                                        onChange={() => setPwdProtection(!pwdProtection)}
                                    />
                                </div>
                                {pwdProtection && (
                                    <div className="p-4 rounded-xl border border-[#2B2A29] bg-[#131211]/30 animate-in slide-in-from-top-1 duration-200">
                                        <FieldLabel>Access Password</FieldLabel>
                                        <PremiumInput
                                            type="password"
                                            placeholder="••••••••••••"
                                            className="font-mono"
                                        />
                                    </div>
                                )}

                                <div className="flex items-center justify-between p-4 rounded-xl bg-[#1A1918] border border-[#2B2A29]">
                                    <div className="space-y-1">
                                        <span className="block text-[13px] font-semibold text-white">
                                            Disable Search Engine Indexing
                                        </span>
                                        <span className="block text-xs text-[#7B7A79]">
                                            Add strict noindex tags to block Google bot crawls.
                                        </span>
                                    </div>
                                    <PremiumToggle
                                        active={noIndex}
                                        onChange={() => setNoIndex(!noIndex)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-150">
                            <div className="flex justify-between items-start gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-1">
                                        Deployment History
                                    </h3>
                                    <p className="text-xs text-[#7B7A79] mb-4">
                                        Review deployment pipelines, build times, and runtime
                                        diagnostics.
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1 select-none">
                                    <span className="text-[10px] font-bold text-[#7B7A79] uppercase tracking-wider">
                                        Build Duration
                                    </span>
                                    <span className="text-[12px] font-mono text-[#D6D5C9] font-semibold bg-[#1A1918] border border-[#2B2A29] px-2 py-0.5 rounded-lg">
                                        18.2s
                                    </span>
                                </div>
                            </div>

                            {/* Build Logs Console */}
                            <div className="space-y-2">
                                <FieldLabel>Terminal Build Logs</FieldLabel>
                                <div className="h-44 bg-[#100E12] rounded-xl border border-[#2B2A29] p-4 font-mono text-[11px] text-green-400 overflow-y-auto space-y-1 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-[#383736]/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                                    <div className="text-neutral-500">
                                        [12:02:11] $ bun run build.ts
                                    </div>
                                    <div>[12:02:12] 🚀 Starting compile loops...</div>
                                    <div>[12:02:13] 🗑️ Cleaning dist cache folder...</div>
                                    <div>[12:02:15] 📄 Processing components index mappings...</div>
                                    <div>[12:02:18] 📦 Bundling 4 JSX modules (vite v5.2)...</div>
                                    <div>
                                        [12:02:22] ✅ Assets generated: chunk-xbhnt5se.js (1.30 MB)
                                    </div>
                                    <div className="text-emerald-400 animate-pulse font-bold">
                                        [12:02:24] ✅ Deploying to edge... Ready!
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-[#2B2A29] bg-[#131211]/30 flex items-center justify-between text-[12.5px]">
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
                    )}

                    {activeTab === 'advanced' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-150">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">
                                    Advanced Settings
                                </h3>
                                <p className="text-xs text-[#7B7A79] mb-4">
                                    Set bundler options, entry commands, and directories.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <FieldLabel>Build Command</FieldLabel>
                                    <PremiumInput
                                        placeholder="bun run build"
                                        className="font-mono text-xs"
                                    />
                                </div>
                                <div>
                                    <FieldLabel>Output Directory</FieldLabel>
                                    <PremiumInput
                                        placeholder="dist"
                                        className="font-mono text-xs"
                                    />
                                </div>
                                <div>
                                    <FieldLabel>Root Directory</FieldLabel>
                                    <PremiumInput placeholder="./" className="font-mono text-xs" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </BigModalOverlay>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// ─── Main Action Controls Header Component ──────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export const OutputHeaderActions: React.FC<OutputHeaderActionsProps> = ({
    projectName,
    activeVersionId,
    isVersionLoading = false,
    onDownload,
}) => {
    const isDownloadDisabled = !activeVersionId || isVersionLoading
    const [activePanel, setActivePanel] = useState<'settings' | 'publish' | null>(null)
    const [settingsTab, setSettingsTab] = useState<
        'general' | 'access' | 'ai' | 'development' | 'analytics' | 'danger'
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
                className={`text-[#91908F] hover:text-white hidden md:flex h-8 w-8 transition-colors outline-none border-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0 ${activePanel === 'settings' && settingsTab === 'general' ? 'text-white bg-white/5' : ''}`}
            >
                <Settings size={16} />
            </Button>

            {/* Share */}
            <Button
                variant="ghost"
                size="icon"
                title="Share"
                onClick={() => openSettings('access')}
                className={`text-[#91908F] hover:text-white hidden md:flex h-8 w-8 transition-colors outline-none border-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0 ${activePanel === 'settings' && settingsTab === 'access' ? 'text-white bg-white/5' : ''}`}
            >
                <Share2 size={16} />
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
                onClick={() => setActivePanel('publish')}
                className={`ml-2 bg-[#171615] hover:bg-[#1E1D1B] text-[#D6D5D4] hover:text-white border border-[#363534] rounded-xl font-medium hidden md:flex px-4 py-1.5 h-auto transition-colors outline-none border-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0 ${activePanel === 'publish' ? 'bg-[#1E1D1B] border-[#4A4948] text-white' : ''}`}
            >
                Publish
            </Button>

            {/* Big full-screen settings overlay */}
            {activePanel === 'settings' && (
                <SettingsBigModal
                    onClose={() => setActivePanel(null)}
                    initialTab={settingsTab}
                    projectName={projectName ?? 'untitled'}
                />
            )}

            {/* Big full-screen publish overlay */}
            {activePanel === 'publish' && <PublishBigModal onClose={() => setActivePanel(null)} />}
        </div>
    )
}
