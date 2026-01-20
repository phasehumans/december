import React, { useEffect, useRef } from 'react';

// 8x8 Bayer Matrix for smooth ordered dithering
const bayerMatrix = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21]
];

class BigWave {
    x: number;
    y: number;
    baseX: number;
    baseY: number;
    radius: number;
    phase: number;
    speedX: number;
    speedY: number;
    
    constructor(w: number, h: number, index: number, total: number) {
        // Distribute loosely across the bottom width
        const segment = w / total;
        this.baseX = (segment * index) + (segment * 0.5);
        
        // Lower base position, but the height scale will make them reach up
        this.baseY = h * 0.9;
        
        // Large radius
        this.radius = Math.min(w, h) * 0.7; 
        
        this.phase = Math.random() * Math.PI * 2;
        
        // Slow, independent drift speeds
        this.speedX = 0.0001 + Math.random() * 0.0002;
        this.speedY = 0.0001 + Math.random() * 0.0002;
    }

    update(w: number, h: number, time: number) {
        // Organic Lissajous movement
        this.x = this.baseX + Math.sin(time * this.speedX + this.phase) * (w * 0.2);
        this.y = this.baseY + Math.sin(time * this.speedY + this.phase * 0.5) * (h * 0.1);
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Increased height scale (1.2) to make them taller
        // Width scale (1.5) to keep them broad
        ctx.scale(1.5, 1.2); 
        
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
        
        // Gradient opacity
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)'); 
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

export const DitherBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        let animationFrame: number;
        let waves: BigWave[] = [];
        
        const scale = 2; 

        const resize = () => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = Math.ceil(parent.clientWidth / scale);
                canvas.height = Math.ceil(parent.clientHeight / scale);
                
                // Reduced to 3 waves
                waves = Array.from({ length: 3 }).map((_, i) => new BigWave(canvas.width, canvas.height, i, 3));
            }
        };

        window.addEventListener('resize', resize);
        resize();

        const loop = (time: number) => {
            if (!ctx) return;
            const w = canvas.width;
            const h = canvas.height;

            // 1. Clear to black
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, w, h);

            // 2. Draw Waves
            ctx.globalCompositeOperation = 'screen';
            waves.forEach(wave => {
                wave.update(w, h, time);
                wave.draw(ctx);
            });
            ctx.globalCompositeOperation = 'source-over';

            // 3. Apply Dither & Vertical Mask
            const imageData = ctx.getImageData(0, 0, w, h);
            const data = imageData.data;
            const pixelW = w;

            const rowMasks = new Float32Array(h);
            for (let y = 0; y < h; y++) {
                const ny = y / h;
                // Slightly adjusted mask power (2.2) to allow waves to be seen a bit higher up
                rowMasks[y] = Math.pow(Math.max(0, ny), 2.2); 
            }

            for (let i = 0; i < data.length; i += 4) {
                const pixelIndex = i / 4;
                const x = pixelIndex % pixelW;
                const y = Math.floor(pixelIndex / pixelW);

                const luminance = data[i]; 
                
                if (luminance < 2) continue;

                const maskedLuminance = luminance * rowMasks[y];

                const threshold = bayerMatrix[y & 7][x & 7]; 
                const thresholdValue = (threshold / 64) * 255;

                const output = maskedLuminance > (thresholdValue + 10) ? 255 : 0;

                data[i] = output;
                data[i + 1] = output;
                data[i + 2] = output;
                data[i + 3] = 255;
            }

            ctx.putImageData(imageData, 0, 0);
            animationFrame = requestAnimationFrame(loop);
        };

        animationFrame = requestAnimationFrame(loop);

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrame);
        };
    }, []);

    return (
        <div className="fixed inset-0 z-0 pointer-events-none bg-black">
            <canvas 
                ref={canvasRef} 
                className="w-full h-full opacity-60" 
                style={{ imageRendering: 'pixelated' }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
        </div>
    );
};