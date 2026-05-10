"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface BackgroundCirclesProps {
  title?: string;
  description?: string;
  className?: string;
  variant?: keyof typeof COLOR_VARIANTS;
}

const COLOR_VARIANTS = {
  primary: {
    border: ["border-emerald-500/60", "border-cyan-400/50", "border-slate-600/30"],
    gradient: "from-emerald-500/30",
  },
  secondary: {
    border: ["border-violet-500/60", "border-fuchsia-400/50", "border-slate-600/30"],
    gradient: "from-violet-500/30",
  },
  tertiary: {
    border: ["border-orange-500/60", "border-yellow-400/50", "border-slate-600/30"],
    gradient: "from-orange-500/30",
  },
  quaternary: {
    border: ["border-purple-500/60", "border-pink-400/50", "border-slate-600/30"],
    gradient: "from-purple-500/30",
  },
  quinary: {
    border: ["border-red-500/60", "border-rose-400/50", "border-slate-600/30"],
    gradient: "from-red-500/30",
  },
  senary: {
    border: ["border-blue-500/60", "border-sky-400/50", "border-slate-600/30"],
    gradient: "from-blue-500/30",
  },
  septenary: {
    border: ["border-gray-500/60", "border-gray-400/50", "border-slate-600/30"],
    gradient: "from-gray-500/30",
  },
  octonary: {
    border: ["border-red-500/60", "border-rose-400/50", "border-slate-600/30"],
    gradient: "from-red-500/30",
  },
} as const;

const AnimatedGrid = () => (
  <motion.div
    animate={{
      backgroundPosition: ["0% 0%", "100% 100%"],
    }}
    className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,transparent_30%,black)]"
    transition={{
      duration: 40,
      repeat: Number.POSITIVE_INFINITY,
      ease: "linear",
    }}
  >
    <div className="h-full w-full [background-image:repeating-linear-gradient(100deg,#64748B_0%,#64748B_1px,transparent_1px,transparent_4%)] opacity-20" />
  </motion.div>
);

export function BackgroundCircles({ title = "", description = "", className, variant = "octonary" }: BackgroundCirclesProps) {
  const variantStyles = COLOR_VARIANTS[variant];

  return (
    <div className={cn("relative flex h-screen w-full items-center justify-center overflow-hidden", className)}>
      <AnimatedGrid />
      <div className="absolute h-[500px] bg-[#171717 w-[750px] max-h-[80vh] max-w-[800vw]">
        {[0, 1, 2].map((i) => (
          <motion.div
            animate={{
              scale: [1, 1.01 + i * 0.005, 1],
              opacity: [0.8, 1, 0.8],
            }}
            className={cn(
              "absolute inset-0 rounded-full",
              "border-none bg-gradient-to-br to-transparent",
              variantStyles.border[i],
              variantStyles.gradient,
            )}
            key={i}
            transition={{
              duration: 5,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
          >
            <div
              className={cn(
                "absolute inset-0 rounded-full mix-blend-screen",
                `bg-[radial-gradient(ellipse_at_center,${variantStyles.gradient.replace("from-", "")}/10%,transparent_70%)]`,
              )}
            />
          </motion.div>
        ))}
      </div>

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 text-center"
        initial={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <h1
          className={cn(
            "text-5xl font-bold tracking-tight md:text-7xl",
            "bg-gradient-to-b from-slate-950 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent",
            "drop-shadow-[0_0_32px_rgba(94,234,212,0.4)]",
          )}
        >
          {title}
        </h1>
        {description && <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">{description}</p>}
      </motion.div>

      <div className="absolute inset-0 [mask-image:radial-gradient(90%_60%_at_50%_50%,#000_40%,transparent)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#0F766E/30%,transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#2DD4BF/15%,transparent)]" />
      </div>
    </div>
  );
}

export function DemoCircles() {
  const [currentVariant, setCurrentVariant] = useState<keyof typeof COLOR_VARIANTS>("octonary");

  const variants = Object.keys(COLOR_VARIANTS) as (keyof typeof COLOR_VARIANTS)[];

  function getNextVariant() {
    const currentIndex = variants.indexOf(currentVariant);
    const nextVariant = variants[(currentIndex + 1) % variants.length];
    return nextVariant;
  }

  return (
    <>
      <BackgroundCircles variant={currentVariant} />
      <div className="absolute top-12 right-12">
        <button
          className="bg-slate-950 dark:bg-white text-white dark:text-slate-950 px-4 py-1 rounded-md z-10 text-sm font-medium"
          onClick={() => {
            setCurrentVariant(getNextVariant());
          }}
          type="button"
        >
          Change Variant
        </button>
      </div>
    </>
  );
}

export type { BackgroundCirclesProps };
export { COLOR_VARIANTS };
