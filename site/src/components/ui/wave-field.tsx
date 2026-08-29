'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WaveFieldProps {
    headline?: string;
    className?: string;
    dark?: boolean;
}

export function WaveField({
    headline = "HARMONIC",
    className = "",
    dark = false,
}: WaveFieldProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isRunning, setIsRunning] = useState(true);

    const pointerRef = useRef({ x: -2000, y: -2000, targetX: -2000, targetY: -2000 });
    const isRunningRef = useRef(isRunning);

    // Mirrored in an effect, not during render: the animation loop reads the ref, and
    // writing refs while rendering is what React's rules forbid.
    useEffect(() => {
        isRunningRef.current = isRunning;
    }, [isRunning]);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        let animId = 0;
        let time = 0;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const rect = entry.contentRect;
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                canvas.width = Math.floor(rect.width * dpr);
                canvas.height = Math.floor(rect.height * dpr);
                canvas.style.width = `${rect.width}px`;
                canvas.style.height = `${rect.height}px`;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(dpr, dpr);
            }
        });
        resizeObserver.observe(container);

        const render = () => {
            if (isRunningRef.current) {
                time += 0.015;
            }

            const width = container.clientWidth;
            const height = container.clientHeight;
            const pointer = pointerRef.current;

            pointer.x += (pointer.targetX - pointer.x) * 0.1;
            pointer.y += (pointer.targetY - pointer.y) * 0.1;

            const isDark = dark || document.documentElement.classList.contains('dark');
            ctx.fillStyle = isDark ? '#040507' : '#ffffff';
            ctx.fillRect(0, 0, width, height);

            const lines = 32;
            const stepY = height / (lines + 1);

            for (let i = 0; i < lines; i++) {
                const yBase = stepY * (i + 1);
                ctx.beginPath();
                const points = 100;
                const stepX = width / points;

                for (let p = 0; p <= points; p++) {
                    const x = p * stepX;
                    const dx = x - pointer.x;
                    const dy = yBase - pointer.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const influence = dist < 250 ? (1 - dist / 250) * 35 : 0;

                    const wave = Math.sin(p * 0.1 + time + i * 0.2) * 18 + Math.cos(p * 0.05 - time * 0.8) * 12;
                    const y = yBase + wave - influence;

                    if (p === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }

                const alpha = 0.12 + (i / lines) * 0.35;
                ctx.strokeStyle = isDark ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            animId = requestAnimationFrame(render);
        };

        animId = requestAnimationFrame(render);
        return () => {
            cancelAnimationFrame(animId);
            resizeObserver.disconnect();
        };
    }, []);

    return (
        <div
            ref={containerRef}
            onMouseMove={(e) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                    pointerRef.current.targetX = e.clientX - rect.left;
                    pointerRef.current.targetY = e.clientY - rect.top;
                }
            }}
            onMouseLeave={() => {
                pointerRef.current.targetX = -2000;
                pointerRef.current.targetY = -2000;
            }}
            className={cn("relative flex h-[400px] w-full select-none flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-[#040507]", className)}
        >
            <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full cursor-crosshair" />
            <div className="relative z-20 flex h-full w-full flex-col justify-between p-6 md:p-8">
                <div className="flex w-full items-center justify-between font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                    <button
                        type="button"
                        onClick={() => setIsRunning(!isRunning)}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-zinc-100/80 px-2.5 py-1.5 backdrop-blur-md transition-colors hover:bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:bg-zinc-800 cursor-pointer"
                        aria-label={isRunning ? "Pause wave animation" : "Resume wave animation"}
                    >
                        {isRunning ? <Pause className="size-3" /> : <Play className="size-3" />}
                        <span>{isRunning ? "FREEZE" : "RUN"}</span>
                    </button>
                </div>
                <div className="pointer-events-none flex flex-col items-center justify-center text-center text-black dark:text-white">
                    <span className="font-mono text-5xl font-black tracking-tighter uppercase sm:text-6xl md:text-7xl">{headline}</span>
                </div>
                <div />
            </div>
        </div>
    );
}

export default WaveField;
