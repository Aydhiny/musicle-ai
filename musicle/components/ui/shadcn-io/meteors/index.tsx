"use client";

import type React from "react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface MeteorsProps {
  number?: number;
  minDelay?: number;
  maxDelay?: number;
  minDuration?: number;
  maxDuration?: number;
  angle?: number;
  className?: string;
}

export const Meteors = ({
  number = 20,
  minDelay = 0.2,
  maxDelay = 1.2,
  minDuration = 2,
  maxDuration = 10,
  angle = 215,
  className,
}: MeteorsProps) => {
  const meteorStyles = useMemo(() => {
    const width = typeof window !== "undefined" ? window.innerWidth : 1200;
    return [...new Array(number)].map((_, idx) => {
      const seed = idx + 1;
      const position = (seed * 173) % Math.max(1, width);
      const delay = minDelay + ((seed % 10) / 10) * (maxDelay - minDelay);
      const duration = minDuration + ((seed % 10) / 10) * (maxDuration - minDuration);
      return {
        "--angle": `${-angle}deg`,
        top: "-5%",
        left: `calc(0% + ${Math.floor(position)}px)`,
        animationDelay: `${delay}s`,
        animationDuration: `${Math.floor(duration)}s`,
      } as React.CSSProperties;
    });
  }, [number, minDelay, maxDelay, minDuration, maxDuration, angle]);

  return (
    <>
      {[...meteorStyles].map((style, idx) => (
        // Meteor Head
        <span
          className={cn(
            "pointer-events-none absolute size-0.5 rotate-[var(--angle)] animate-meteor rounded-full bg-zinc-500 shadow-[0_0_0_1px_#ffffff10]",
            className,
          )}
          key={idx}
          style={{ ...style }}
        >
          {/* Meteor Tail */}
          <div className="pointer-events-none absolute top-1/2 -z-10 h-px w-[50px] -translate-y-1/2 bg-gradient-to-r from-zinc-500 to-transparent" />
        </span>
      ))}
    </>
  );
};
