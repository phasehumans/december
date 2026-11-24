import React from 'react'

import {
    OFFICE_H,
    OFFICE_W,
    ROLE_NAME,
    drawOffice,
    type OfficeLabel,
    type Role,
} from '../office/officeEngine'

import { cn } from '@/shared/lib/utils'

const ROLES = Object.keys(ROLE_NAME) as Role[]
const STILL_FRAME_MS = 6500

// live pixel office for the super crew card. animates only while it is on screen and the
// user has not asked for reduced motion; otherwise it shows one still frame.
// compact: for small frames. the office fills the frame without stretching (the sides are
// cut off) and the name tags are left out, they do not fit at that size.
export const OfficeCanvas: React.FC<{
    className?: string
    style?: React.CSSProperties
    compact?: boolean
}> = ({ className, style, compact = false }) => {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
    const tagRefs = React.useRef<Partial<Record<Role, HTMLSpanElement | null>>>({})

    React.useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) return
        ctx.imageSmoothingEnabled = false

        const placeTags = (labels: OfficeLabel[]) => {
            const seen = new Set<Role>()
            for (const l of labels) {
                const el = tagRefs.current[l.role]
                if (!el) continue
                seen.add(l.role)
                el.style.display = 'block'
                el.style.left = `${((l.x / OFFICE_W) * 100).toFixed(2)}%`
                el.style.top = `${((l.y / OFFICE_H) * 100).toFixed(2)}%`
                el.style.transform = l.below
                    ? 'translate(-50%, 1px)'
                    : 'translate(-50%, calc(-100% - 1px))'
            }
            for (const role of ROLES) {
                const el = tagRefs.current[role]
                if (el && !seen.has(role)) el.style.display = 'none'
            }
        }

        const render = (t: number) => {
            ctx.clearRect(0, 0, OFFICE_W, OFFICE_H)
            placeTags(drawOffice(ctx, t))
        }

        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        render(STILL_FRAME_MS)
        if (reduceMotion) return

        let frame = 0
        let visible = true
        const loop = (t: number) => {
            if (visible) render(t)
            frame = requestAnimationFrame(loop)
        }
        frame = requestAnimationFrame(loop)

        const observer =
            typeof IntersectionObserver !== 'undefined'
                ? new IntersectionObserver((entries) => {
                      visible = entries.some((e) => e.isIntersecting)
                  })
                : null
        observer?.observe(canvas)

        return () => {
            cancelAnimationFrame(frame)
            observer?.disconnect()
        }
    }, [])

    return (
        <div className={className} style={{ ...style, position: 'relative' }}>
            <canvas
                ref={canvasRef}
                width={OFFICE_W}
                height={OFFICE_H}
                aria-hidden="true"
                className={cn('absolute inset-0 w-full h-full', compact && 'object-cover')}
                style={{ imageRendering: 'pixelated' }}
            />
            {!compact &&
                ROLES.map((role) => (
                    <span
                        key={role}
                        ref={(el) => {
                            tagRefs.current[role] = el
                        }}
                        className="absolute hidden pointer-events-none whitespace-nowrap rounded-[4px] border border-[#282828] bg-[#1F1F1F] px-[3px] text-[8px] leading-[12px] font-medium text-[#EDEDEF]"
                    >
                        {ROLE_NAME[role]}
                    </span>
                ))}
        </div>
    )
}
