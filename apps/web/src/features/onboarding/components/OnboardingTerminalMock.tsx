import React from 'react'

import { version as cliVersion } from '../../../../../../package.json'

// A December CLI session drawn in HTML, for the CLI card on the onboarding start step and the
// "Try December CLI" card in the sidebar.
// Same mock as the landing page (apps/docs TerminalWindowMock.astro): the window is laid out at
// real size with the rows and colors of the TUI (packages/tui), then a 680 x 425 stage is scaled
// down to the panel width, so the card shows only the top-left part of the window.
// Place it inside a panel that has the Tailwind `@container` class.
// Sizes are props so a small card can zoom in: `stage` is how many real pixels fit across the card
// (smaller = bigger text). The window has a 13% left and 17% top background margin by default:
// `marginLeft` and `marginTop` (a share of the stage width and height) change it.

// TUI theme colors (packages/tui/src/theme.ts)
const c = {
    brand: '#89B4F8',
    text: '#E4E4E7',
    muted: '#A1A1AA',
    dim: '#71717A',
    border: '#3F3F46',
    surface: '#262629',
    success: '#6EE7B7',
    error: '#F87171',
    diffAddBg: '#0F2419',
    diffDeleteBg: '#2C1214',
}

// Live diff of the latest edit (formatDiffRow: line number, sign, text on a tinted band)
const diff = [
    { type: 'add', no: 4, text: "import { rateLimit } from '../middleware/rate-limit'" },
    { type: 'delete', no: 18, text: "router.post('/login', login)" },
    {
        type: 'add',
        no: 18,
        text: "router.post('/login', rateLimit({ max: 5, windowMs: 60_000 }), login)",
    },
] as const

const diffStyle = {
    add: { bg: c.diffAddBg, sign: '+ ', signColor: c.success },
    delete: { bg: c.diffDeleteBg, sign: '- ', signColor: c.error },
}

const Dot = () => <span style={{ color: c.dim }}>● </span>
const Blank = () => <p>&nbsp;</p>

interface OnboardingTerminalMockProps {
    stage?: number
    marginLeft?: number
    marginTop?: number
}

export const OnboardingTerminalMock: React.FC<OnboardingTerminalMockProps> = ({
    stage = 680,
    marginLeft = 0.13,
    marginTop = 0.17,
}) => (
    <div
        className="absolute inset-0 overflow-hidden"
        role="img"
        aria-label="December CLI in a terminal window"
    >
        <div
            className="absolute left-0 top-0 origin-top-left select-none"
            style={{
                width: stage,
                height: stage * 0.625,
                transform: `scale(tan(atan2(100cqw, ${stage}px)))`,
            }}
        >
            <div
                style={{
                    left: Math.round(stage * marginLeft),
                    top: Math.round(stage * 0.625 * marginTop),
                }}
                className="absolute w-[1000px] h-[420px] flex flex-col overflow-hidden rounded-[12px] border border-[#3a3a3a] bg-[#18181b] shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
            >
                <div className="relative flex items-center h-[34px] shrink-0 bg-[#111113] border-b border-[#27272a] px-[14px]">
                    <span className="relative z-10 flex gap-[8px]">
                        <span className="w-[12px] h-[12px] rounded-full bg-[#ff5f57]" />
                        <span className="w-[12px] h-[12px] rounded-full bg-[#febc2e]" />
                        <span className="w-[12px] h-[12px] rounded-full bg-[#28c840]" />
                    </span>
                    <span className="ml-[18px] font-sans text-[12.5px] text-[#a1a1aa]">
                        december · ~/code/december
                    </span>
                </div>

                <div
                    className="flex-1 min-h-0 px-[14px] pt-[10px] font-mono text-[13px] leading-[17px] [&>p]:whitespace-pre [&>p]:overflow-hidden"
                    style={{ color: c.muted }}
                >
                    <p>
                        <span className="font-bold" style={{ color: c.brand }}>
                            ✱{' '}
                        </span>
                        <span className="font-bold" style={{ color: c.text }}>
                            December
                        </span>
                        <span style={{ color: c.dim }}> v{cliVersion}</span>
                    </p>
                    <p style={{ color: c.dim }}>team@trydecember.com</p>
                    <p style={{ color: c.dim }}>Claude Sonnet 5.5 · Claude Subscription</p>
                    <p style={{ color: c.dim }}>~/code/december (main)</p>
                    <Blank />

                    <p
                        className="-mx-[14px] px-[14px]"
                        style={{ background: c.surface, color: c.text }}
                    >
                        <span style={{ color: c.dim }}>❭ </span>
                        add rate limiting to the login route, 5 tries per minute for each IP
                    </p>
                    <Blank />

                    <p>
                        <Dot />
                        <span style={{ color: c.text }}>Created</span> src/middleware/rate-limit.ts
                        {'  '}
                        <span style={{ color: c.dim }}>38 lines</span>
                    </p>
                    <p>
                        <Dot />
                        <span style={{ color: c.text }}>Edited</span> src/auth/auth.routes.ts{'  '}
                        <span style={{ color: c.success }}>+2</span>{' '}
                        <span style={{ color: c.error }}>-1</span>
                    </p>
                    {diff.map((row) => {
                        const st = diffStyle[row.type]
                        return (
                            <p
                                key={`${row.type}-${row.no}-${row.text}`}
                                style={{ background: st.bg }}
                            >
                                <span style={{ color: c.dim }}>{String(row.no).padStart(6)} </span>
                                <span style={{ color: st.signColor }}>{st.sign}</span>
                                <span style={{ color: c.text }}>{row.text}</span>
                            </p>
                        )
                    })}
                    <p>
                        <Dot />
                        <span style={{ color: c.text }}>Ran</span> bun test test/auth{'  '}
                        <span style={{ color: c.dim }}>2.4s</span>
                    </p>
                    <p style={{ color: c.dim }}>{'  └ 42 pass, 0 fail'}</p>
                    <Blank />
                    <p style={{ color: c.text }}>
                        Added a rate limit of 5 login tries per minute for each IP. All 42 auth
                        tests pass.
                    </p>
                    <Blank />
                    <p style={{ color: c.dim }}>
                        <span style={{ color: c.brand }}>✱</span> Worked for 1m 12s
                    </p>
                    <Blank />

                    <p style={{ color: c.border }}>{'─'.repeat(140)}</p>
                    <p>
                        <span style={{ color: c.text }}>❭ </span>
                        <span
                            className="inline-block w-[8px] h-[15px] align-[-3px]"
                            style={{ background: c.text }}
                        />
                        <span style={{ color: c.dim }}>
                            Ask December to build features, fix bugs, or work on your code…
                        </span>
                    </p>
                    <p style={{ color: c.border }}>{'─'.repeat(140)}</p>
                    <p style={{ color: c.dim }}>Claude Sonnet 5.5</p>
                </div>
            </div>
        </div>
    </div>
)
