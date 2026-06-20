import { ChevronLeft, Copy, Check } from 'lucide-react'
import React, { useState } from 'react'

import { Icons } from '@/shared/components/ui/Icons'
import terminalPng from '../../../../public/terminal.png'

interface CliPageProps {
    onBack?: () => void
}

export const CliPage: React.FC<CliPageProps> = ({ onBack }) => {
    const [copied, setCopied] = useState(false)
    const [activeTab, setActiveTab] = useState<'bun' | 'npm' | 'curl'>('bun')

    const commands = {
        bun: 'bun install -g @december/cli',
        npm: 'npm install -g @december/cli',
        curl: 'curl -fsSL https://cli.december.dev/install.sh | bash',
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(commands[activeTab])
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const docsUrl =
        (typeof process !== 'undefined' ? process.env.DOCS_URL : undefined) ||
        'http://localhost:3005'

    return (
        <div className="flex w-full h-full bg-[#100E12] overflow-hidden p-1.5 md:p-[8px] font-sans">
            <div className="flex w-full h-full bg-[#171615] rounded-lg border border-[#242323] overflow-y-auto lg:overflow-hidden relative">
                {/* Minimal Back Button */}
                {onBack && (
                    <button
                        onClick={onBack}
                        className="absolute top-5 left-5 flex items-center justify-center text-[#8F8E8D] hover:text-white transition-colors z-20 cursor-pointer"
                        title="Go back"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                )}

                <div className="flex w-full h-full p-6 md:p-10 pt-16 md:pt-20 lg:pt-[80px] gap-8 lg:gap-12 flex-col lg:flex-row max-w-[1300px] mx-auto items-start">
                    {/* Left Side */}
                    <div className="flex-1 flex flex-col justify-start w-full lg:max-w-[45%]">
                        <div className="flex flex-col w-full pl-0 lg:pl-4">
                            {/* Logo & Heading on same line & size */}
                            <div className="flex items-center gap-3 mb-4">
                                {/* <Icons.DecemberLogo className="w-8 h-8 lg:w-9 lg:h-9 text-[#EFEFEF]" /> */}
                                <h1 className="text-[26px] lg:text-[32px] font-semibold text-[#F4F4F5] tracking-tight leading-none">
                                    ✱ December CLI
                                </h1>
                            </div>

                            {/* Subtitle */}
                            <p className="text-[#A1A1AA] font-mono text-[13px] leading-[1.6] mb-6 max-w-[400px]">
                                December now runs locally in your terminal.
                                <br />
                                Try it out in less than a minute.
                            </p>

                            {/* Pills */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                {(['bun', 'npm', 'curl'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => {
                                            setActiveTab(tab)
                                            setCopied(false)
                                        }}
                                        className={`px-3 py-1 rounded-[6px] text-[12px] font-mono transition-colors cursor-pointer border outline-none ${
                                            activeTab === tab
                                                ? 'bg-[#2A2A2A] text-white border-[#3A3A3A]'
                                                : 'bg-transparent text-[#71717A] border-transparent hover:text-[#D4D4D8]'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {/* Command Box and Read Docs */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-8 w-full max-w-[480px]">
                                <div className="flex-1 min-w-0 flex items-center justify-between border border-[#2A2A2A] rounded-[8px] h-10 px-3 bg-transparent transition-colors hover:border-[#3A3A3A]">
                                    <code className="text-[#D4D4D8] font-mono text-[13px] select-all truncate min-w-0 flex-1 mr-2">
                                        <span className="text-[#52525B] mr-2 select-none">$</span>
                                        {commands[activeTab]}
                                    </code>
                                    <button
                                        onClick={handleCopy}
                                        className="text-[#52525B] hover:text-[#D4D4D8] transition-colors cursor-pointer flex-shrink-0 outline-none"
                                        title="Copy command"
                                    >
                                        {copied ? (
                                            <Check className="w-4 h-4 text-emerald-500" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                                <a
                                    href={docsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center border border-[#2A2A2A] rounded-[8px] px-4 h-10 text-[#D4D4D8] font-mono text-[12px] hover:bg-[#222] transition-colors whitespace-nowrap cursor-pointer select-none flex-shrink-0"
                                >
                                    READ DOCS
                                </a>
                            </div>

                            {/* Image Placeholder */}
                            <div className="w-full max-w-[480px] rounded-[8px] overflow-hidden">
                                <img
                                    src={terminalPng}
                                    alt="Terminal"
                                    className="w-full h-auto object-cover opacity-90"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Side */}
                    <div className="flex-1 flex flex-col justify-start w-full h-full pt-8 lg:pt-0">
                        <div className="w-full max-w-[560px] mx-auto">
                            <h2 className="text-[26px] lg:text-[32px] font-semibold text-[#F4F4F5] tracking-tight leading-[1.1] mb-3">
                                The intelligence of December
                                <br />
                                in your terminal
                            </h2>
                            <p className="text-[#A1A1AA] font-mono text-[13px] leading-[1.6] mb-8 pb-8 border-b border-white/5">
                                Get started with December on your local machine, then hand off to
                                the leading cloud agent.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2">
                                {/* Grid item 1 */}
                                <div className="border-b border-r-0 sm:border-r border-white/5 pb-6 pr-0 sm:pr-6 mb-6 sm:mb-0">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[#E4E4E7] font-mono text-[11px]">
                                            01
                                        </span>
                                    </div>
                                    <h3 className="text-[#F4F4F5] text-[15px] font-medium tracking-tight mb-2">
                                        Runs on your machine
                                    </h3>
                                    <p className="text-[#A1A1AA] font-mono text-[12px] leading-[1.6]">
                                        <span className="text-[#52525B] mr-1">{'>'}</span> Optimized
                                        for interactive work, with full access to your codebase,
                                        local tools, credentials, and shell environment. Run agent
                                        tasks locally with instant execution.
                                    </p>
                                </div>

                                {/* Grid item 2 */}
                                <div className="border-b border-white/5 pb-6 pl-0 sm:pl-6 mb-6 sm:mb-0">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[#E4E4E7] font-mono text-[11px]">
                                            02
                                        </span>
                                    </div>
                                    <h3 className="text-[#F4F4F5] text-[15px] font-medium tracking-tight mb-2">
                                        Hand off to the cloud
                                    </h3>
                                    <p className="text-[#A1A1AA] font-mono text-[12px] leading-[1.6]">
                                        <span className="text-[#52525B] mr-1">{'>'}</span> Seamless
                                        hand off to December in the cloud, with its own VM, isolated
                                        container testing, video recordings, autofix and more. Come
                                        back to a fully polished, merged PR.
                                    </p>
                                </div>

                                {/* Grid item 3 */}
                                <div className="border-b sm:border-b-0 border-r-0 sm:border-r border-white/5 pt-0 sm:pt-6 pb-6 sm:pb-0 pr-0 sm:pr-6 mb-6 sm:mb-0">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[#E4E4E7] font-mono text-[11px]">
                                            03
                                        </span>
                                    </div>
                                    <h3 className="text-[#F4F4F5] text-[15px] font-medium tracking-tight mb-2">
                                        Multi-model
                                    </h3>
                                    <p className="text-[#A1A1AA] font-mono text-[12px] leading-[1.6]">
                                        <span className="text-[#52525B] mr-1">{'>'}</span> All of
                                        your favorite frontier models in one place, including Claude
                                        4.5 Opus, GPT-5 Omni, DeepSeek R2, and SWE-1.6. Switch
                                        models instantly depending on complexity.
                                    </p>
                                </div>

                                {/* Grid item 4 */}
                                <div className="pt-0 sm:pt-6 pl-0 sm:pl-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[#E4E4E7] font-mono text-[11px]">
                                            04
                                        </span>
                                    </div>
                                    <h3 className="text-[#F4F4F5] text-[15px] font-medium tracking-tight mb-2">
                                        Superfast
                                    </h3>
                                    <p className="text-[#A1A1AA] font-mono text-[12px] leading-[1.6]">
                                        <span className="text-[#52525B] mr-1">{'>'}</span> Written
                                        in Rust and so performant that it can run on an original
                                        VT100 terminal. Low memory footprint, instant startup, and
                                        blazing-fast codebase indexing.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
