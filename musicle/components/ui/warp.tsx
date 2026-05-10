"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { useCallback, useMemo } from "react";

export interface WarpBackgroundProps {
  className?: string;
  children?: React.ReactNode;
  /** Perspective depth in pixels */
  perspective?: number;
  /** Number of beams per wall */
  beamsPerSide?: number;
  /** Beam width as percentage */
  beamSize?: number;
  /** Maximum beam delay in seconds */
  beamDelayMax?: number;
  /** Minimum beam delay in seconds */
  beamDelayMin?: number;
  /** Beam animation duration in seconds */
  beamDuration?: number;
  /** Grid line color */
  gridColor?: string;
}

interface BeamProps {
  width: string;
  x: string;
  delay: number;
  duration: number;
  seed: number;
}

function Beam({ width, x, delay, duration, seed }: BeamProps) {
  const hue = (seed * 137) % 360;
  const aspectRatio = (seed % 10) + 1;

  return (
    <motion.div
      className="absolute top-0"
      style={{
        left: x,
        width,
        aspectRatio: `1 / ${aspectRatio}`,
        background: `linear-gradient(hsl(${hue} 80% 60%), transparent)`,
        transform: "translateX(-50%)",
      }}
      initial={{ y: "100cqmax" }}
      animate={{ y: "-100%" }}
      transition={{
        duration,
        delay,
        repeat: Number.POSITIVE_INFINITY,
        ease: "linear",
      }}
    />
  );
}

const wallClasses = "[transform-style:preserve-3d] [container-type:inline-size] [height:100cqmax]";

function createGridBackground(gridColor: string, beamSize: string) {
  return {
    backgroundImage: `linear-gradient(${gridColor} 0 1px, transparent 1px ${beamSize}), linear-gradient(90deg, ${gridColor} 0 1px, transparent 1px ${beamSize})`,
    backgroundSize: `${beamSize} ${beamSize}`,
  };
}

export function WarpBackground({
  className,
  children,
  perspective = 100,
  beamsPerSide = 3,
  beamSize = 5,
  beamDelayMax = 3,
  beamDelayMin = 0,
  beamDuration = 3,
  gridColor = "rgba(63, 63, 70, 0.5)",
}: WarpBackgroundProps) {
  const generateBeams = useCallback((seedOffset: number) => {
    const beams = [];
    const cellsPerSide = Math.floor(100 / beamSize);
    const step = cellsPerSide / beamsPerSide;

    for (let i = 0; i < beamsPerSide; i++) {
      const x = Math.floor(i * step);
      const delay = beamDelayMin + (((seedOffset + i) % 10) / 10) * (beamDelayMax - beamDelayMin);
      beams.push({ x, delay, seed: seedOffset + i });
    }
    return beams;
  }, [beamsPerSide, beamSize, beamDelayMax, beamDelayMin]);

  const topBeams = useMemo(() => generateBeams(0), [generateBeams]);
  const rightBeams = useMemo(() => generateBeams(20), [generateBeams]);
  const bottomBeams = useMemo(() => generateBeams(40), [generateBeams]);
  const leftBeams = useMemo(() => generateBeams(60), [generateBeams]);

  const beamSizeStr = `${beamSize}%`;
  const gridStyle = createGridBackground(gridColor, beamSizeStr);

  return (
    <div className={cn("fixed inset-0 overflow-hidden bg-neutral-950", className)}>
      {/* 3D Tunnel Container */}
      <div
        className="pointer-events-none absolute inset-0 [clip-path:inset(0)] [container-type:size] [transform-style:preserve-3d]"
        style={{ perspective }}
      >
        {/* Top wall */}
        <div
          className={cn(wallClasses, "absolute z-20 [width:100cqi] [transform-origin:50%_0%] [transform:rotateX(-90deg)]")}
          style={gridStyle}
        >
          {topBeams.map((beam, i) => (
            <Beam key={i} delay={beam.delay} duration={beamDuration} width={beamSizeStr} x={`${beam.x * beamSize}%`} seed={beam.seed} />
          ))}
        </div>

        {/* Bottom wall */}
        <div
          className={cn(wallClasses, "absolute top-full [width:100cqi] [transform-origin:50%_0%] [transform:rotateX(-90deg)]")}
          style={gridStyle}
        >
          {bottomBeams.map((beam, i) => (
            <Beam key={i} delay={beam.delay} duration={beamDuration} width={beamSizeStr} x={`${beam.x * beamSize}%`} seed={beam.seed} />
          ))}
        </div>

        {/* Left wall */}
        <div
          className={cn(
            wallClasses,
            "absolute left-0 top-0 [width:100cqh] [transform-origin:0%_0%] [transform:rotate(90deg)_rotateX(-90deg)]",
          )}
          style={gridStyle}
        >
          {leftBeams.map((beam, i) => (
            <Beam key={i} delay={beam.delay} duration={beamDuration} width={beamSizeStr} x={`${beam.x * beamSize}%`} seed={beam.seed} />
          ))}
        </div>

        {/* Right wall */}
        <div
          className={cn(
            wallClasses,
            "absolute right-0 top-0 [width:100cqh] [transform-origin:100%_0%] [transform:rotate(-90deg)_rotateX(-90deg)]",
          )}
          style={gridStyle}
        >
          {rightBeams.map((beam, i) => (
            <Beam key={i} delay={beam.delay} duration={beamDuration} width={beamSizeStr} x={`${beam.x * beamSize}%`} seed={beam.seed} />
          ))}
        </div>
      </div>

      {/* Content layer */}
      {children && <div className="relative z-10 h-full w-full">{children}</div>}
    </div>
  );
}

export default function WarpBackgroundDemo() {
  return <WarpBackground />;
}
