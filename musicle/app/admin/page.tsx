"use client";

import Link from "next/link";
import { Brain, Shield, BarChart3, Users, Settings, ChevronRight, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={() => void copy()} className="ml-2 text-white/30 hover:text-white/70 transition-colors">
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

const CARDS = [
  {
    icon: Brain,
    title: "ML Model Dashboard",
    description: "Live model metrics — accuracy, confusion matrix, feature importance, K-Means clusters, cross-validation, genre drift.",
    href: "/ml",
    badge: "Public",
    badgeColor: "emerald",
  },
  {
    icon: BarChart3,
    title: "Site Dashboard",
    description: "Per-user stats, engagement scores, feedback leaderboard, trend radar.",
    href: "/dashboard",
    badge: "Auth required",
    badgeColor: "violet",
  },
  {
    icon: Shield,
    title: "Moderation Panel",
    description: "Review posts, comments, and waveform comments. Requires the admin token below.",
    href: "/admin/moderation",
    badge: "Admin token",
    badgeColor: "amber",
  },
  {
    icon: Users,
    title: "Feed",
    description: "Community highlight posts, reactions, and comments.",
    href: "/feed",
    badge: "Public",
    badgeColor: "emerald",
  },
];

export default function AdminIndexPage() {
  return (
    <div className="min-h-screen text-white mt-20" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-violet-400 text-xs font-semibold uppercase tracking-widest mb-2">
            <Settings className="w-4 h-4" /> Admin Hub
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Musicle Admin</h1>
          <p className="mt-2 text-sm text-white/40 max-w-xl">
            Central hub for all dashboards and admin tools. The ML Model Dashboard is public
            and requires no login.
          </p>
        </div>

        {/* Default credentials box */}
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
            <Shield className="w-4 h-4" /> Default Credentials (dev)
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm font-mono">
            {[
              { label: "Email",    value: "admin@musicle.app" },
              { label: "Username", value: "admin" },
              { label: "Password", value: "Admin@Musicle2026!" },
              { label: "Admin token (X-Admin-Token header)", value: "musicle-admin-2026" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/4 rounded-xl p-3 border border-white/8">
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{label}</div>
                <div className="flex items-center text-white/80">
                  <span className="truncate">{value}</span>
                  <CopyButton text={value} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-amber-400/60">
            Change these before deploying to production. Set via appsettings.json → Seed + Admin sections.
          </p>
        </div>

        {/* Navigation cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          {CARDS.map(({ icon: Icon, title, description, href, badge, badgeColor }) => (
            <Link
              key={href}
              href={href}
              className="group bg-white/3 hover:bg-white/6 border border-white/8 hover:border-white/15 rounded-2xl p-5 transition-all flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-violet-300" />
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                  badgeColor === "emerald"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : badgeColor === "amber"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    : "border-violet-500/30 bg-violet-500/10 text-violet-300"
                }`}>
                  {badge}
                </span>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white group-hover:text-violet-200 transition-colors mb-1">{title}</div>
                <p className="text-xs text-white/50 leading-relaxed">{description}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-white/30 group-hover:text-violet-400 transition-colors">
                Open <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          ))}
        </div>

        {/* ML Dashboard shortcut notice */}
        <div className="bg-violet-500/8 border border-violet-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-violet-400 shrink-0" />
            <div>
              <div className="font-semibold text-white mb-0.5">ML Dashboard is always accessible</div>
              <p className="text-xs text-white/50 leading-relaxed">
                The <Link href="/ml" className="text-violet-300 underline underline-offset-2">ML Engine page</Link> shows
                real-time model accuracy, training history, feature importance, confusion matrix, K-Means clusters,
                Pearson correlations, cross-validation results, and genre drift detection — no login required.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
