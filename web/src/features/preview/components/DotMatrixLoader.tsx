import React, { useEffect, useRef } from 'react'

interface DotMatrixLoaderProps {
    color?: string
    dotSize?: number
    gap?: number
    gridSize?: number
    speed?: number
    className?: string
    variant?: 'plasma-veil' | 'helix-glow'
}

export const DotMatrixLoader: React.FC<DotMatrixLoaderProps> = ({
    color = '#EDEDED', // Warm white/silver to match overall dark theme
    dotSize = 3,
    gap = 4,
    gridSize = 8, // Reduced from 10 to slightly shrink
    speed = 0.06,
    className,
    variant = 'plasma-veil',
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        const size = gridSize * (dotSize + gap) + gap
        canvas.width = size * dpr
        canvas.height = size * dpr
        canvas.style.width = `${size}px`
        canvas.style.height = `${size}px`
        ctx.scale(dpr, dpr)

        let animationFrameId: number
        let angle = 0

        const draw = () => {
            if (!ctx || !canvas) return
            ctx.clearRect(0, 0, size, size)
            angle += speed

            const centerX = size / 2
            const centerY = size / 2

            if (variant === 'plasma-veil') {
                // Plasma Veil: Elegant circular ring of dots rotating with a trail
                const numDots = 10
                const radius = size * 0.32

                for (let i = 0; i < numDots; i++) {
                    const dotAngle = (i / numDots) * Math.PI * 2
                    const posX = centerX + Math.cos(dotAngle) * radius
                    const posY = centerY + Math.sin(dotAngle) * radius

                    // Fading trail math
                    const diff = Math.cos(dotAngle - angle) * 0.5 + 0.5
                    const intensity = Math.pow(diff, 2.2)

                    ctx.fillStyle = color
                    ctx.globalAlpha = Math.max(0.1, intensity)
                    ctx.beginPath()
                    ctx.arc(posX, posY, dotSize / 1.1, 0, Math.PI * 2)
                    ctx.fill()

                    if (intensity > 0.8) {
                        ctx.save()
                        ctx.shadowColor = color
                        ctx.shadowBlur = 3
                        ctx.globalAlpha = (intensity - 0.8) * 1.5
                        ctx.beginPath()
                        ctx.arc(posX, posY, dotSize * 0.6, 0, Math.PI * 2)
                        ctx.fill()
                        ctx.restore()
                    }
                }
            } else {
                // Helix Glow: Mesmerizing double-helix DNA-like wave across a grid (3D projection)
                for (let x = 0; x < gridSize; x++) {
                    for (let y = 0; y < gridSize; y++) {
                        const posX = gap + x * (dotSize + gap) + dotSize / 2
                        const posY = gap + y * (dotSize + gap) + dotSize / 2

                        // Scale x coord to sine wave angle (slightly less than full cycle for aesthetic curve)
                        const waveX = (x / gridSize) * Math.PI * 1.8
                        const yCenter = (gridSize - 1) / 2

                        // Projected 3D Double Helix (Phase difference is exactly PI)
                        const t = angle * 1.5
                        const waveY1 = yCenter + Math.sin(waveX - t) * (gridSize * 0.35)
                        const waveY2 = yCenter + Math.sin(waveX - t + Math.PI) * (gridSize * 0.35)

                        // Calculate vertical distance to waves
                        const dist1 = Math.abs(y - waveY1)
                        const dist2 = Math.abs(y - waveY2)

                        const intensity1 = Math.max(0, 1 - dist1 / 1.0)
                        const intensity2 = Math.max(0, 1 - dist2 / 1.0)
                        const intensity = Math.max(intensity1, intensity2)

                        ctx.fillStyle = color
                        ctx.globalAlpha = Math.max(0.06, intensity * 0.95)

                        ctx.beginPath()
                        ctx.arc(posX, posY, dotSize / 2.1, 0, Math.PI * 2)
                        ctx.fill()

                        if (intensity > 0.7) {
                            ctx.save()
                            ctx.shadowColor = color
                            ctx.shadowBlur = 4
                            ctx.globalAlpha = (intensity - 0.7) * 1.3
                            ctx.beginPath()
                            ctx.arc(posX, posY, dotSize / 1.9, 0, Math.PI * 2)
                            ctx.fill()
                            ctx.restore()
                        }
                    }
                }
            }

            animationFrameId = requestAnimationFrame(draw)
        }

        draw()

        return () => {
            cancelAnimationFrame(animationFrameId)
        }
    }, [color, dotSize, gap, gridSize, speed, variant])

    return (
        <div className={`inline-flex items-center justify-center shrink-0 ${className ?? ''}`}>
            <canvas ref={canvasRef} className="block" />
        </div>
    )
}
