import {
    ArrowUpRight,
    ChevronLeft,
    ChevronRight,
    GitBranch,
    Lock,
    MoreHorizontal,
    RotateCw,
} from 'lucide-react'
import React from 'react'

import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'

// December on the web drawn in HTML, for the web card on the onboarding start step.
// Same mock as the landing page (apps/docs WebWindowMock.astro): a 1100 x 740 browser window laid
// out with the sizes, colors and icons of the app (Sidebar, HomeHeader, HomeHero, PromptInput,
// PromptFooter), then a 680 x 425 stage is scaled down to the panel width, so the card shows only
// the top-left part of the window. The prompt box sits in the middle of the page, so only part of
// it shows. Place it inside a panel that has the Tailwind `@container` class.
// Sizes are props so a small card can zoom in: `stage` is how many real pixels fit across the card
// (smaller = bigger text). The window keeps the same 13% left and 17% top background margin.
// `windowWidth` and `promptTop` move the title and prompt box into view on a small card.

const recentSessions = [
    { title: 'Add rate limiting to login', meta: 'Running', running: true },
    { title: 'Fix the flaky checkout test', meta: '2h ago', pr: 214 },
    { title: 'Dark mode for settings', meta: 'Yesterday', pr: 209 },
    { title: 'Upgrade to React 19', meta: '3d ago' },
    { title: 'Add CSV export to reports', meta: '5d ago', pr: 197 },
]

const navItemClass = 'flex items-center gap-2.5 px-2.5 h-[30px] text-[#919191]'
const navLabelClass = 'font-medium text-[13.5px] tracking-tight'

interface OnboardingWebMockProps {
    stage?: number
    windowWidth?: number
    /** space above the prompt box's title row, as HomeHero's top padding */
    promptTop?: number
}

export const OnboardingWebMock: React.FC<OnboardingWebMockProps> = ({
    stage = 680,
    windowWidth = 1100,
    promptTop = 160,
}) => (
    <div
        className="absolute inset-0 overflow-hidden"
        role="img"
        aria-label="December web app in a browser window"
    >
        <div
            className="absolute left-0 top-0 origin-top-left select-none font-sans leading-normal"
            style={{
                width: stage,
                height: stage * 0.625,
                transform: `scale(tan(atan2(100cqw, ${stage}px)))`,
            }}
        >
            <div
                style={{
                    left: Math.round(stage * 0.13),
                    top: Math.round(stage * 0.625 * 0.17),
                    width: windowWidth,
                }}
                className="absolute h-[740px] flex flex-col overflow-hidden rounded-[12px] border border-[#3a3a3a] bg-[#141414] shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
            >
                {/* Tab strip */}
                <div className="flex items-end h-[40px] shrink-0 bg-[#0e0e0e] pl-[16px]">
                    <span className="self-center flex gap-[8px]">
                        <span className="w-[12px] h-[12px] rounded-full bg-[#ff5f57]" />
                        <span className="w-[12px] h-[12px] rounded-full bg-[#febc2e]" />
                        <span className="w-[12px] h-[12px] rounded-full bg-[#28c840]" />
                    </span>
                    <div className="ml-[22px] flex items-center gap-[8px] w-[230px] h-[32px] px-[12px] rounded-t-[9px] bg-[#232323] text-[12px] text-[#e5e5e5]">
                        <Icons.DecemberLogo className="w-[15px] h-[15px] text-white" />
                        <span className="truncate">December</span>
                        <span className="ml-auto text-[#8a8a8a] text-[14px]">×</span>
                    </div>
                    <span className="self-center ml-[12px] text-[16px] text-[#8a8a8a]">+</span>
                </div>

                {/* Address bar */}
                <div className="flex items-center gap-[14px] h-[40px] shrink-0 bg-[#232323] px-[14px] text-[#9a9a9a] border-b border-black/40">
                    <ChevronLeft className="w-[17px] h-[17px]" />
                    <ChevronRight className="w-[17px] h-[17px] opacity-40" />
                    <RotateCw className="w-[15px] h-[15px]" />
                    <div className="flex-1 flex items-center gap-[8px] h-[28px] rounded-full bg-[#171717] px-[14px] text-[13px] text-[#d4d4d4]">
                        <Lock className="w-[12px] h-[12px] text-[#9a9a9a]" />
                        app.trydecember.com
                    </div>
                </div>

                <div className="flex flex-1 min-h-0">
                    {/* Sidebar.tsx, open */}
                    <div className="w-[200px] shrink-0 flex flex-col bg-sidebar border-r border-white/5">
                        <div className="px-3 mb-2">
                            <div className="flex items-center justify-between px-2 h-11 mb-2">
                                <Icons.DecemberLogo className="w-6 h-6 text-[#D6D5D4]" />
                                <Icons.SidebarToggle className="w-4 h-4 text-[#919191]" />
                            </div>
                            <div className="flex flex-col gap-[1px]">
                                <div className="flex items-center gap-2.5 px-2.5 h-[30px] rounded-[9px] bg-[#1F1F1F]">
                                    <div className="w-[19px] h-[19px] rounded-full bg-[#333333] flex items-center justify-center shrink-0">
                                        <Icons.Plus
                                            className="w-2.5 h-2.5 text-[#E8E8E8]"
                                            strokeWidth={2.5}
                                        />
                                    </div>
                                    <span className={cn(navLabelClass, 'text-[#D6D5D4]')}>New</span>
                                </div>
                                <div className={navItemClass}>
                                    <Icons.Search className="w-[17px] h-[17px]" />
                                    <span className={navLabelClass}>Search</span>
                                </div>
                                <div className={navItemClass}>
                                    <div className="relative flex items-center justify-center">
                                        <Icons.Folder className="w-[17px] h-[17px]" />
                                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 border border-[#1E1E1E]" />
                                    </div>
                                    <span className={navLabelClass}>Sessions</span>
                                </div>
                                <div className={navItemClass}>
                                    <Icons.Settings className="w-[17px] h-[17px]" />
                                    <span className={navLabelClass}>Settings</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col px-3 min-h-0">
                            <div className="flex items-center justify-between px-2.5 h-7">
                                <span className="font-semibold text-[11.5px] text-[#8F8E8D] tracking-tight">
                                    Recent
                                </span>
                                <MoreHorizontal className="w-3.5 h-3.5 text-[#919191]" />
                            </div>
                            <div className="flex flex-col gap-[2px] mt-1">
                                {recentSessions.map((session) => (
                                    <div
                                        key={session.title}
                                        className={cn(
                                            'flex flex-col px-2.5 py-1.5 rounded-xl',
                                            session.running && 'bg-[#202020]'
                                        )}
                                    >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            {session.running && (
                                                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-400" />
                                            )}
                                            <span className="font-normal text-[12.5px] tracking-tight text-[#EDEDED] truncate leading-snug">
                                                {session.title}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[11px] text-[#8F8E8D] tracking-tight mt-[2px]">
                                            <span
                                                className={cn(
                                                    session.running &&
                                                        'text-emerald-400 font-medium'
                                                )}
                                            >
                                                {session.meta}
                                            </span>
                                            {session.pr && (
                                                <>
                                                    <span className="text-[#555]">•</span>
                                                    <span className="text-[#C084FC] inline-flex items-center gap-0.5 font-mono text-[10.5px]">
                                                        <Icons.GitPullRequest className="w-3 h-3 text-[#C084FC]" />
                                                        {session.pr}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* HomeHero.tsx */}
                    <div className="relative flex-1 min-w-0 flex flex-col">
                        {/* HomeHeader.tsx */}
                        <div className="flex items-center justify-between h-11 px-6 shrink-0">
                            <div className="flex items-center gap-1.5">
                                <span className="flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-[#1F1F1F] text-[12px] font-medium text-[#999999]">
                                    Credits: <span className="text-[#E8E8E8]">$5.00</span>
                                </span>
                                <span className="flex items-center gap-1 h-7 px-2.5 rounded-full bg-[#1F1F1F] text-[12px] font-medium text-[#999999]">
                                    Docs
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                </span>
                            </div>
                            <span className="w-7 h-7 flex items-center justify-center text-[#999999]">
                                <Icons.Github className="w-5 h-5" />
                            </span>
                        </div>

                        <div
                            style={{ paddingTop: promptTop }}
                            className="flex flex-col items-center w-full max-w-4xl mx-auto px-4"
                        >
                            <div className="relative w-full max-w-[638px]">
                                <div className="absolute bottom-[calc(100%+10px)] left-0 flex items-center gap-2 ml-2">
                                    <Icons.DecemberLogo
                                        className="w-[26px] h-[26px] text-white"
                                        strokeWidth={1}
                                    />
                                    <span className="text-[23px] font-normal tracking-[-0.025em] text-white leading-none">
                                        December <span className="text-[#87B2F4]">Agent</span>
                                    </span>
                                </div>

                                {/* PromptInput.tsx + PromptFooter.tsx */}
                                <div className="rounded-[17px] bg-[#1F1F1F] border border-[#313131] flex flex-col">
                                    <div className="flex flex-wrap items-start pt-[12px] pl-5 pr-12 pb-1 min-h-[72px] text-[14.5px]">
                                        <span className="flex items-center gap-1.5 text-[#E8E8E8] text-[12.5px] font-medium mr-1.5 mb-1 bg-[#2A2928] px-2 py-0.5 rounded-[6px]">
                                            <Icons.Github className="w-3.5 h-3.5 text-white" />
                                            acme/storefront
                                        </span>
                                        <span className="flex items-center gap-1.5 bg-[#2A2928] text-[#EDEDEF] text-[12px] font-medium mr-1.5 mb-1 px-2 py-0.5 rounded-[6px]">
                                            <GitBranch className="w-3.5 h-3.5 text-[#8F8E8D]" />
                                            main
                                        </span>
                                        <p className="basis-full mt-1 font-medium leading-relaxed text-[#D6D5D4]">
                                            Add rate limiting to the login route. Allow 5 tries per
                                            minute for each IP
                                            <span className="inline-block w-px h-[18px] ml-px align-[-4px] bg-white" />
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between px-3 pb-3 pt-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="flex items-center justify-center w-8 h-8 rounded-full text-[#8E8E8E]">
                                                <Icons.Plus className="w-[18px] h-[18px] stroke-[2.5px]" />
                                            </span>
                                            <span className="flex items-center gap-1.5 ml-1 px-2.5 py-1 rounded-full text-[12px] font-medium text-[#8E8E8E] border border-white/5">
                                                <Icons.Sparkles className="w-3 h-3 text-[#E08734]" />
                                                Claude Sonnet 5.5
                                                <Icons.ChevronDown className="w-3 h-3 opacity-60" />
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="flex items-center justify-center w-8 h-8 rounded-full text-[#8E8E8E]">
                                                <Icons.Microphone className="w-[14px] h-[14px] stroke-[2.5px]" />
                                            </span>
                                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#EDEDED] text-[#090a0f]">
                                                <Icons.ArrowRight className="w-4 h-4 stroke-[2px]" />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
)
