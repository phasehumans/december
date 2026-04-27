import React, { useRef, useEffect, useState } from 'react'
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
} from 'lucide-react'

import { Button } from '@/shared/components/ui/Button'
import type { BackendProjectVersionSummary } from '@/features/projects/api/project'

interface OutputHeaderActionsProps {
    projectName?: string | null
    versions?: BackendProjectVersionSummary[]
    activeVersionId?: string | null
    isVersionLoading?: boolean
    onSelectVersion?: (versionId: string) => void
    onDownload?: () => void
}

type ActivePanel = 'settings' | 'share' | 'publish' | null

function useOutsideClick(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [ref, onClose])
}

// ─── Panel wrapper — always anchors to far right of the actions bar ───────────
const FloatingPanel: React.FC<{
    title: string
    onClose: () => void
    children: React.ReactNode
}> = ({ title, onClose, children }) => (
    <div
        className="absolute right-0 top-[calc(100%+10px)] w-[280px] bg-[#1E1D1C] border border-[#2A2928] rounded-2xl shadow-2xl shadow-black/70 z-50 overflow-hidden"
        style={{ animation: 'panelIn 0.14s ease' }}
    >
        <style>{`@keyframes panelIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2928]">
            <span className="text-[13px] font-semibold text-[#D6D5D4] tracking-wide">{title}</span>
            <button
                onClick={onClose}
                className="p-1 rounded-lg text-[#555453] hover:text-[#D6D5D4] hover:bg-white/5 transition-colors"
            >
                <X size={14} />
            </button>
        </div>
        <div className="p-4 space-y-4">{children}</div>
    </div>
)

// ─── Field primitives ─────────────────────────────────────────────────────────
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-[#555453] mb-1.5">
        {children}
    </label>
)

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
    className = '',
    ...props
}) => (
    <input
        {...props}
        className={`w-full bg-[#171615] border border-[#2A2928] rounded-xl px-3 py-2 text-[13px] text-[#D6D5D4] placeholder-[#3E3D3C] outline-none focus:border-[#4A4948] transition-colors ${className}`}
    />
)

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
    children,
    ...props
}) => (
    <select
        {...props}
        className="w-full bg-[#171615] border border-[#2A2928] rounded-xl px-3 py-2 text-[13px] text-[#D6D5D4] outline-none focus:border-[#4A4948] transition-colors appearance-none"
    >
        {children}
    </select>
)

// ─── Settings Panel ───────────────────────────────────────────────────────────
const SettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [name, setName] = useState('')
    const [analytics, setAnalytics] = useState(true)

    return (
        <FloatingPanel title="Settings" onClose={onClose}>
            <div>
                <Label>Rename project</Label>
                <Input
                    placeholder="my-project"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>

            {/* Analytics toggle */}
            <div className="flex items-center justify-between pt-1">
                <span className="text-[13px] text-[#9B9A99]">Enable analytics</span>
                <button
                    onClick={() => setAnalytics(!analytics)}
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${analytics ? 'bg-[#4A4948]' : 'bg-[#2A2928]'}`}
                >
                    <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[#D6D5D4] shadow transition-transform duration-200 ${analytics ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                </button>
            </div>

            <div className="pt-1">
                <button
                    className="w-full rounded-xl px-4 py-2 text-[13px] font-medium text-[#D6D5D4] border border-[#2A2928] hover:border-[#4A4948] hover:text-white transition-colors bg-[#171615]"
                    onClick={onClose}
                >
                    Save changes
                </button>
            </div>
        </FloatingPanel>
    )
}

// ─── Share Panel ──────────────────────────────────────────────────────────────
const SharePanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [copied, setCopied] = useState(false)
    const [email, setEmail] = useState('')
    const [access, setAccess] = useState<'private' | 'anyone' | 'team'>('anyone')
    const shareUrl = 'https://phasehumans.dev/p/my-project'

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const accessOptions: { value: typeof access; icon: React.ReactNode; label: string }[] = [
        { value: 'private', icon: <Lock size={12} />, label: 'Private' },
        { value: 'anyone', icon: <Globe size={12} />, label: 'Anyone' },
        { value: 'team', icon: <Users size={12} />, label: 'Team' },
    ]

    return (
        <FloatingPanel title="Share" onClose={onClose}>
            {/* Access selector */}
            <div>
                <Label>Who can access</Label>
                <div className="flex gap-1.5">
                    {accessOptions.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setAccess(opt.value)}
                            className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-[11px] font-medium border transition-colors ${
                                access === opt.value
                                    ? 'bg-[#272625] border-[#4A4948] text-[#D6D5D4]'
                                    : 'border-[#2A2928] text-[#555453] hover:text-[#9B9A99] hover:bg-[#232221]'
                            }`}
                        >
                            {opt.icon}
                            <span>{opt.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Invite */}
            <div>
                <Label>Invite collaborator</Label>
                <div className="flex gap-2">
                    <Input
                        placeholder="name@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="flex-1"
                    />
                    <button className="shrink-0 px-3 rounded-xl text-[12px] font-medium border border-[#2A2928] text-[#9B9A99] hover:text-[#D6D5D4] hover:border-[#4A4948] bg-[#171615] transition-colors">
                        Invite
                    </button>
                </div>
            </div>

            {/* Share link */}
            <div>
                <Label>Share link</Label>
                <div className="flex items-center gap-2 bg-[#171615] border border-[#2A2928] rounded-xl px-3 py-2">
                    <Globe size={13} className="shrink-0 text-[#555453]" />
                    <span className="flex-1 text-[12px] text-[#555453] truncate">{shareUrl}</span>
                    <button
                        onClick={handleCopy}
                        className="shrink-0 text-[#555453] hover:text-[#D6D5D4] transition-colors"
                        title="Copy link"
                    >
                        {copied ? (
                            <Check size={13} className="text-emerald-500" />
                        ) : (
                            <Copy size={13} />
                        )}
                    </button>
                </div>
            </div>
        </FloatingPanel>
    )
}

// ─── Publish Panel ────────────────────────────────────────────────────────────
const PublishPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [domain, setDomain] = useState('')
    const [env, setEnv] = useState('production')
    const [deploying, setDeploying] = useState(false)
    const [deployed, setDeployed] = useState(false)

    const handleDeploy = () => {
        setDeploying(true)
        setTimeout(() => {
            setDeploying(false)
            setDeployed(true)
            setTimeout(() => setDeployed(false), 3000)
        }, 1800)
    }

    return (
        <FloatingPanel title="Publish" onClose={onClose}>
            <div>
                <Label>Custom domain</Label>
                <Input
                    placeholder="yourdomain.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                />
                <p className="text-[11px] text-[#3E3D3C] mt-1.5 leading-relaxed">
                    Leave blank to publish on phasehumans.dev
                </p>
            </div>

            <div>
                <Label>Environment</Label>
                <Select value={env} onChange={(e) => setEnv(e.target.value)}>
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="preview">Preview</option>
                </Select>
            </div>

            <div className="pt-1">
                <button
                    onClick={handleDeploy}
                    disabled={deploying || deployed}
                    className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium border transition-all duration-200 ${
                        deployed
                            ? 'border-emerald-800/60 text-emerald-400 bg-emerald-950/30'
                            : deploying
                              ? 'border-[#2A2928] text-[#555453] bg-[#171615] cursor-wait'
                              : 'border-[#2A2928] text-[#9B9A99] bg-[#171615] hover:border-[#4A4948] hover:text-[#D6D5D4]'
                    }`}
                >
                    {deployed ? (
                        <>
                            <Check size={14} />
                            <span>Deployed</span>
                        </>
                    ) : deploying ? (
                        <>
                            <span className="w-3.5 h-3.5 rounded-full border border-[#4A4948] border-t-transparent animate-spin" />
                            <span>Deploying…</span>
                        </>
                    ) : (
                        <>
                            <Rocket size={14} />
                            <span>Deploy to {env}</span>
                        </>
                    )}
                </button>
            </div>
        </FloatingPanel>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────
export const OutputHeaderActions: React.FC<OutputHeaderActionsProps> = ({
    activeVersionId,
    isVersionLoading = false,
    onDownload,
}) => {
    const isDownloadDisabled = !activeVersionId || isVersionLoading
    const [activePanel, setActivePanel] = useState<ActivePanel>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const toggle = (panel: ActivePanel) => setActivePanel((prev) => (prev === panel ? null : panel))

    useOutsideClick(containerRef as React.RefObject<HTMLElement>, () => setActivePanel(null))

    return (
        // The panel's `right-0` anchors to this container's right edge — same position for all 3
        <div ref={containerRef} className="flex items-center gap-0.5 relative">
            {/* Settings */}
            <Button
                variant="ghost"
                size="icon"
                title="Settings"
                onClick={() => toggle('settings')}
                className={`text-[#91908F] hover:text-white hidden md:flex h-8 w-8 transition-colors ${activePanel === 'settings' ? 'text-white bg-white/5' : ''}`}
            >
                <Settings size={16} />
            </Button>

            {/* Share */}
            <Button
                variant="ghost"
                size="icon"
                title="Share"
                onClick={() => toggle('share')}
                className={`text-[#91908F] hover:text-white hidden md:flex h-8 w-8 transition-colors ${activePanel === 'share' ? 'text-white bg-white/5' : ''}`}
            >
                <Share2 size={16} />
            </Button>

            {/* Download */}
            <Button
                variant="ghost"
                size="icon"
                title="Download Code"
                className="text-[#91908F] hover:text-white hidden md:flex h-8 w-8 disabled:opacity-40 disabled:text-[#91908F]"
                onClick={onDownload}
                disabled={isDownloadDisabled}
            >
                <Download size={16} />
            </Button>

            {/* Publish */}
            <Button
                onClick={() => toggle('publish')}
                className={`ml-2 bg-[#171615] hover:bg-[#1E1D1B] text-[#D6D5D4] hover:text-white border border-[#363534] rounded-xl font-medium hidden md:flex px-4 py-1.5 h-auto transition-colors ${activePanel === 'publish' ? 'bg-[#1E1D1B] border-[#4A4948] text-white' : ''}`}
            >
                Publish
            </Button>

            {/* Single panel portal — always anchors right-0 of this container */}
            {activePanel === 'settings' && <SettingsPanel onClose={() => setActivePanel(null)} />}
            {activePanel === 'share' && <SharePanel onClose={() => setActivePanel(null)} />}
            {activePanel === 'publish' && <PublishPanel onClose={() => setActivePanel(null)} />}
        </div>
    )
}
