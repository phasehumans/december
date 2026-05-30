import React, { useEffect, useRef } from 'react'

interface DotmSquare15Props {
    size?: number
    dotSize?: number
    speed?: number
    bloom?: boolean
    opacityBase?: number
    opacityMid?: number
    opacityPeak?: number
    cellPadding?: number
    boxSize?: number
    minSize?: number
    pattern?: 'cross' | 'helix' | 'wave' | 'grid' | 'prism-sweep'
    colorPreset?: 'grad-aurora' | 'white' | 'warm-gray'
    muted?: boolean
    animated?: boolean
    className?: string
}

export const DotmSquare15: React.FC<DotmSquare15Props> = ({
    size = 32,
    dotSize = 3,
    speed = 1.0,
    bloom = false,
    opacityBase = 0.08,
    opacityMid = 0.35,
    opacityPeak = 0.9,
    cellPadding,
    boxSize,
    minSize,
    pattern = 'helix',
    colorPreset = 'white',
    muted = false,
    animated = true,
    className,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const gridSize = pattern === 'prism-sweep' ? 6 : 15 // Use 6x6 grid for crisp, beautifully spaced prism-sweep
        const effectiveSize = Math.max(minSize || 0, boxSize || size)

        // Handle high DPI screens
        const dpr = window.devicePixelRatio || 1
        canvas.width = effectiveSize * dpr
        canvas.height = effectiveSize * dpr
        canvas.style.width = `${effectiveSize}px`
        canvas.style.height = `${effectiveSize}px`
        ctx.scale(dpr, dpr)

        // Math for spacing and dots alignment
        const totalPadding =
            cellPadding !== undefined ? cellPadding : (effectiveSize * 0.12) / (gridSize - 1)
        const totalGridSpace = effectiveSize - effectiveSize * 0.12 // Keep safe margin
        const step = totalGridSpace / (gridSize - 1)
        const margin = (effectiveSize - step * (gridSize - 1)) / 2

        let animationFrameId: number
        let angle = 0

        const draw = () => {
            if (!ctx || !canvas) return
            ctx.clearRect(0, 0, effectiveSize, effectiveSize)

            if (animated) {
                angle += 0.05 * speed
            }

            // Colors based on preset
            let primaryColor = '#EDEDED'
            let accentColor = '#8E8D8C'

            if (colorPreset === 'grad-aurora') {
                primaryColor = '#60A5FA' // Aurora blue
                accentColor = '#F472B6' // Aurora pink
            } else if (colorPreset === 'warm-gray') {
                primaryColor = '#E6E4E3'
                accentColor = '#8E8D8C'
            }

            for (let x = 0; x < gridSize; x++) {
                for (let y = 0; y < gridSize; y++) {
                    // Pixel positions inside canvas
                    const posX = margin + x * step
                    const posY = margin + y * step

                    // Compute dynamic intensity based on pattern math
                    let intensity = 0.0

                    if (pattern === 'prism-sweep') {
                        // Highly polished Prism Sweep: diagonal comet trail sweeping top-left to bottom-right
                        const totalDiags = gridSize * 2
                        const sweepPos = ((angle * 1.5) % (totalDiags + 3)) - 1 // Elegant, responsive timing loop

                        const dotDiag = x + y
                        const diff = sweepPos - dotDiag

                        if (diff >= 0) {
                            // Smooth exponential decay trail behind the sweep head
                            intensity = Math.pow(Math.E, -diff * 0.65)
                        } else {
                            // Very sharp onset/activation as the sweep head hits
                            intensity = Math.pow(Math.E, diff * 2.5)
                        }
                    } else if (pattern === 'cross') {
                        // Light up vertical & horizontal cross bands pulsating outwards
                        const dx = Math.abs(x - (gridSize - 1) / 2)
                        const dy = Math.abs(y - (gridSize - 1) / 2)
                        const distToCross = Math.min(dx, dy)

                        const wave = Math.sin(Math.max(dx, dy) * 0.5 - angle * 1.5) * 0.5 + 0.5
                        intensity = Math.max(0, 1 - distToCross / 1.5) * wave
                    } else if (pattern === 'helix') {
                        // Double helix DNA waves moving diagonally across the 15x15 grid
                        const distDiag = ((x + y) / (gridSize * 2)) * Math.PI * 2.2

                        const wave1 =
                            (gridSize - 1) / 2 +
                            Math.sin(distDiag - angle * 1.6) * ((gridSize - 1) * 0.32)
                        const wave2 =
                            (gridSize - 1) / 2 +
                            Math.sin(distDiag - angle * 1.6 + Math.PI) * ((gridSize - 1) * 0.32)

                        const dist1 = Math.abs(y - wave1)
                        const dist2 = Math.abs(y - wave2)

                        const intensity1 = Math.max(0, 1 - dist1 / 1.2)
                        const intensity2 = Math.max(0, 1 - dist2 / 1.2)
                        intensity = Math.max(intensity1, intensity2)
                    } else if (pattern === 'wave') {
                        // Circular ripple starting from the center dot
                        const cx = (gridSize - 1) / 2
                        const cy = (gridSize - 1) / 2
                        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
                        intensity = Math.sin(dist * 0.45 - angle * 2.0) * 0.5 + 0.5
                        intensity = Math.pow(intensity, 1.8)
                    } else {
                        // Grid layout subtle checker pulsing waves
                        intensity = Math.sin(x * 0.3 + y * 0.3 - angle) * 0.5 + 0.5
                    }

                    // Apply opacity mappings
                    let finalAlpha = opacityBase
                    if (intensity > 0.3) {
                        finalAlpha =
                            opacityMid + ((intensity - 0.3) * (opacityPeak - opacityMid)) / 0.7
                    } else {
                        finalAlpha = opacityBase + (intensity * (opacityMid - opacityBase)) / 0.3
                    }

                    if (muted) {
                        finalAlpha *= 0.45
                    }

                    // Draw dot base
                    ctx.save()

                    // Render color presets (including beautiful aurora gradients and prism-sweep rainbow spectrum)
                    if (pattern === 'prism-sweep') {
                        // Dynamic shifting spectral hue based on diagonal position and animation step
                        const hue = (((x + y) / (gridSize * 2)) * 220 + angle * 40) % 360
                        ctx.fillStyle = `hsl(${hue}, 90%, 65%)`
                    } else if (colorPreset === 'grad-aurora') {
                        // Interpolate gradient across coordinates
                        const ratio = (x + y) / (gridSize * 2)
                        ctx.fillStyle = ratio > 0.5 ? primaryColor : accentColor
                    } else {
                        ctx.fillStyle = primaryColor
                    }

                    ctx.globalAlpha = Math.max(0.04, finalAlpha)

                    ctx.beginPath()
                    ctx.arc(posX, posY, dotSize / 2, 0, Math.PI * 2)
                    ctx.fill()

                    // Bloom shader glow effect
                    if (bloom && finalAlpha > 0.5) {
                        ctx.shadowColor =
                            pattern === 'prism-sweep'
                                ? `hsl(${(((x + y) / (gridSize * 2)) * 220 + angle * 40) % 360}, 90%, 65%)`
                                : colorPreset === 'grad-aurora'
                                  ? accentColor
                                  : primaryColor
                        ctx.shadowBlur = dotSize * 2.2
                        ctx.globalAlpha = (finalAlpha - 0.5) * 1.4
                        ctx.beginPath()
                        ctx.arc(posX, posY, dotSize / 1.8, 0, Math.PI * 2)
                        ctx.fill()
                    }
                    ctx.restore()
                }
            }

            animationFrameId = requestAnimationFrame(draw)
        }

        draw()

        return () => {
            cancelAnimationFrame(animationFrameId)
        }
    }, [
        size,
        dotSize,
        speed,
        bloom,
        opacityBase,
        opacityMid,
        opacityPeak,
        cellPadding,
        boxSize,
        minSize,
        pattern,
        colorPreset,
        muted,
        animated,
    ])

    return (
        <div className={`inline-flex items-center justify-center shrink-0 ${className ?? ''}`}>
            <canvas ref={canvasRef} className="block" />
        </div>
    )
}
