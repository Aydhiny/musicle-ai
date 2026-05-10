"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addCommentToPost,
  createHighlightPost,
  getDashboardOverview,
  getFeedbackLeaderboard,
  getHighlightsFeed,
  getMyDashboard,
  getTrackTimeline,
  getTrendRadar,
  HighlightPost,
  FeedbackLeaderboard,
  DashboardOverview,
  TrendRadar,
  TrackRevision,
  UserDashboard,
  togglePostReaction,
  PostMedia,
} from "@/services/backendApi";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { resolveApiUrl } from "@/lib/api-url";
import NextImage from "next/image";
import {
  Activity,
  Brain,
  Flame,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
  Heart,
  Image as ImageIcon,
  Music,
} from "lucide-react";

const REACTIONS = [
  { key: "like", label: "Like", icon: Heart },
  { key: "fire", label: "Fire", icon: Flame },
  { key: "spark", label: "Spark", icon: Sparkles },
  { key: "clap", label: "Clap", icon: Zap },
  { key: "insight", label: "Insight", icon: Brain },
  { key: "wow", label: "Wow", icon: Star },
];

function formatTimeAgo(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function initials(userName: string): string {
  const parts = userName.trim().split(/\s+/);
  if (parts.length === 0) return "MU";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function resolveMediaUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  if (url.startsWith("/api/")) {
    return resolveApiUrl(url);
  }
  return url;
}

function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        nodes.push(
          <strong key={`${keyPrefix}-b-${key++}`}>{text.slice(i + 2, end)}</strong>,
        );
        i = end + 2;
        continue;
      }
    }

    if (text.startsWith("*", i)) {
      const end = text.indexOf("*", i + 1);
      if (end !== -1) {
        nodes.push(
          <em key={`${keyPrefix}-i-${key++}`}>{text.slice(i + 1, end)}</em>,
        );
        i = end + 1;
        continue;
      }
    }

    const next = text.slice(i + 1).search(/\*/);
    if (next === -1) {
      nodes.push(text.slice(i));
      break;
    }
    nodes.push(text.slice(i, i + 1 + next));
    i += 1 + next;
  }

  return nodes;
}

function renderContent(content: string, format: string): React.ReactNode {
  if (format === "plain") {
    return <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">{content}</p>;
  }

  const lines = content.split(/\r?\n/);
  return (
    <p className="text-sm text-white/85 leading-relaxed">
      {lines.map((line, idx) => (
        <span key={`line-${idx}`}>
          {parseInline(line, `line-${idx}`)}
          {idx < lines.length - 1 && <br />}
        </span>
      ))}
    </p>
  );
}

function analysisBackdrop(genre: string): string {
  const key = genre.toLowerCase();
  if (key.includes("hip") || key.includes("rap")) return "from-amber-500/20 via-rose-500/10 to-transparent";
  if (key.includes("pop")) return "from-pink-500/20 via-fuchsia-500/10 to-transparent";
  if (key.includes("rock")) return "from-slate-500/20 via-emerald-500/10 to-transparent";
  if (key.includes("elect")) return "from-cyan-500/20 via-violet-500/10 to-transparent";
  if (key.includes("lofi") || key.includes("lo-fi")) return "from-emerald-500/15 via-slate-500/10 to-transparent";
  return "from-violet-500/20 via-indigo-500/10 to-transparent";
}

function scoreTone(score: number): string {
  if (score >= 8) return "text-emerald-300";
  if (score >= 6) return "text-amber-300";
  return "text-rose-300";
}

function isComparisonPost(post: HighlightPost): boolean {
  const title = post.title?.toLowerCase() ?? "";
  const content = post.content?.toLowerCase() ?? "";
  return title.includes("a/b") || content.includes("a/b comparison") || content.includes("a/b");
}

function extractComparisonDelta(content: string): number | null {
  const deltas = Array.from(content.matchAll(/\(([-+]?\d+(?:\.\d+)?)\)/g))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));

  if (deltas.length === 0) {
    return null;
  }

  return deltas.reduce((sum, value) => sum + value, 0);
}

function inferComparisonWinner(post: HighlightPost): { winner: "A" | "B" | "tie"; deltaTotal: number } | null {
  if (!isComparisonPost(post)) {
    return null;
  }

  const deltaTotal = extractComparisonDelta(post.content);
  if (deltaTotal === null) {
    return { winner: "tie", deltaTotal: 0 };
  }

  if (deltaTotal > 0.1) {
    return { winner: "B", deltaTotal };
  }
  if (deltaTotal < -0.1) {
    return { winner: "A", deltaTotal };
  }
  return { winner: "tie", deltaTotal };
}

export default function MusicleFeedPage() {
  const router = useRouter();
  const { token, isAuthenticated, user } = useAuth();
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [myDashboard, setMyDashboard] = useState<UserDashboard | null>(null);
  const [posts, setPosts] = useState<HighlightPost[]>([]);
  const [trendRadar, setTrendRadar] = useState<TrendRadar | null>(null);
  const [leaderboard, setLeaderboard] = useState<FeedbackLeaderboard | null>(null);
  const [page, setPage] = useState(1);
  const [feedMode, setFeedMode] = useState<"recent" | "trending" | "for-you">("recent");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPost, setNewPost] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [showMedia, setShowMedia] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submittingCommentFor, setSubmittingCommentFor] = useState<string | null>(null);
  const [revisionChains, setRevisionChains] = useState<Record<string, TrackRevision[]>>({});
  const [revisionLoading, setRevisionLoading] = useState<Record<string, boolean>>({});

  const fetchFeed = useCallback(
    async (nextPage: number, append: boolean, mode: "recent" | "trending" | "for-you") => {
      const feed = await getHighlightsFeed(nextPage, 20, token ?? undefined, mode);
      setPosts((prev) => (append ? [...prev, ...feed.posts] : feed.posts));
      setPage(nextPage);
    },
    [token],
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [overviewResponse, trendsResponse, leaderboardResponse] = await Promise.all([
        getDashboardOverview(),
        getTrendRadar(),
        getFeedbackLeaderboard(8),
        fetchFeed(1, false, feedMode),
      ]);
      setOverview(overviewResponse);
      setTrendRadar(trendsResponse);
      setLeaderboard(leaderboardResponse);

      if (token) {
        try {
          const mine = await getMyDashboard(token);
          setMyDashboard(mine);
        } catch {
          setMyDashboard(null);
        }
      } else {
        setMyDashboard(null);
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Failed to load feed data.");
    } finally {
      setLoading(false);
    }
  }, [fetchFeed, feedMode, token]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const canPublish = useMemo(() => newPost.trim().length >= 3, [newPost]);

  const applyFormat = (tokenValue: string) => {
    const el = textAreaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const before = newPost.slice(0, start);
    const selected = newPost.slice(start, end);
    const after = newPost.slice(end);
    const nextValue = `${before}${tokenValue}${selected}${tokenValue}${after}`;
    setNewPost(nextValue);

    requestAnimationFrame(() => {
      const cursorStart = start + tokenValue.length;
      const cursorEnd = cursorStart + selected.length;
      el.focus();
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const publishPost = async () => {
    if (!token) {
      router.push("/login");
      return;
    }

    if (!canPublish) {
      return;
    }

    setSubmittingPost(true);
    setError(null);

    try {
      const media: PostMedia[] = [];
      if (imageUrl.trim()) {
        media.push({ type: "image", url: imageUrl.trim() });
      }
      if (audioUrl.trim()) {
        media.push({ type: "audio", url: audioUrl.trim() });
      }

      const created = await createHighlightPost(
        {
          title: newTitle.trim() || undefined,
          content: newPost.trim(),
          contentFormat: "markdown",
          media,
        },
        token,
      );

      setPosts((prev) => [created, ...prev]);
      setNewPost("");
      setNewTitle("");
      setImageUrl("");
      setAudioUrl("");
      setShowMedia(false);
      await refreshAll();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Failed to publish post.");
    } finally {
      setSubmittingPost(false);
    }
  };

  const toggleReaction = async (postId: string, reaction: string) => {
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const result = await togglePostReaction(postId, reaction, token);
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                reactionCounts: result.reactionCounts,
                currentUserReaction: result.isActive ? result.reaction : null,
              }
            : post,
        ),
      );
    } catch (reactionError) {
      setError(reactionError instanceof Error ? reactionError.message : "Failed to update reaction.");
    }
  };

  const submitComment = async (postId: string) => {
    const draft = commentDrafts[postId]?.trim();
    if (!draft) {
      return;
    }

    if (!token) {
      router.push("/login");
      return;
    }

    setSubmittingCommentFor(postId);
    setError(null);

    try {
      const comment = await addCommentToPost(postId, draft, token);
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                commentCount: post.commentCount + 1,
                comments: [comment, ...post.comments].slice(0, 5),
              }
            : post,
        ),
      );

      setCommentDrafts((prev) => ({
        ...prev,
        [postId]: "",
      }));

      await refreshAll();
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : "Failed to comment.");
    } finally {
      setSubmittingCommentFor(null);
    }
  };

  const loadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      await fetchFeed(nextPage, true, feedMode);
    } catch (loadMoreError) {
      setError(loadMoreError instanceof Error ? loadMoreError.message : "Failed to load more posts.");
    } finally {
      setLoadingMore(false);
    }
  };

  const loadRevisionChain = async (trackId: string) => {
    if (revisionLoading[trackId]) {
      return;
    }

    setRevisionLoading((prev) => ({ ...prev, [trackId]: true }));
    try {
      const chain = await getTrackTimeline(trackId);
      setRevisionChains((prev) => ({ ...prev, [trackId]: chain }));
    } catch {
      setRevisionChains((prev) => ({ ...prev, [trackId]: [] }));
    } finally {
      setRevisionLoading((prev) => ({ ...prev, [trackId]: false }));
    }
  };

  return (
    <div className="min-h-screen mt-24 text-white" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Community Feed</h1>
            <p className="text-sm text-white/40 mt-1">Live social data, comments, reactions, and Musicle AI trends</p>
          </div>

          <div className="flex items-center gap-2">
            {(["recent", "trending", "for-you"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFeedMode(mode)}
                className={`h-10 px-4 rounded-xl text-xs font-semibold border transition-all ${
                  feedMode === mode
                    ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                    : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                }`}
              >
                {mode === "recent" ? "Latest" : mode === "trending" ? "Trending" : "For You"}
              </button>
            ))}
            <button
              onClick={() => void refreshAll()}
              className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {overview && (
          <div className="mb-8 bg-white/3 border border-violet-400/20 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-violet-400/15 border border-violet-400/20 flex items-center justify-center flex-shrink-0">
              <Brain className="w-5 h-5 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-violet-300 uppercase tracking-wider mb-1">Musicle AI Insight</div>
              <p className="text-sm text-white font-medium">{overview.insight.headline}</p>
              <p className="text-xs text-white/45 mt-1">{overview.insight.summary}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
            <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
              <div className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Your Dashboard</div>

              {isAuthenticated && myDashboard ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-white font-semibold truncate">{myDashboard.userName}</div>
                    <div className="text-xs text-white/35 truncate">{myDashboard.email}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/4 rounded-xl p-2.5 text-center">
                      <div className="text-lg font-bold text-white">{myDashboard.postsPublished}</div>
                      <div className="text-[10px] text-white/30">Posts</div>
                    </div>
                    <div className="bg-white/4 rounded-xl p-2.5 text-center">
                      <div className="text-lg font-bold text-white">{myDashboard.commentsWritten}</div>
                      <div className="text-[10px] text-white/30">Comments</div>
                    </div>
                    <div className="bg-white/4 rounded-xl p-2.5 text-center">
                      <div className="text-lg font-bold text-white">{myDashboard.postLikesReceived}</div>
                      <div className="text-[10px] text-white/30">Likes Received</div>
                    </div>
                    <div className="bg-white/4 rounded-xl p-2.5 text-center">
                      <div className="text-lg font-bold text-violet-300">{myDashboard.engagementScore}</div>
                      <div className="text-[10px] text-white/30">Engagement</div>
                    </div>
                  </div>

                  <div className="text-[11px] text-white/35">Logged in as @{user?.userName}</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-white/40">Sign in to publish posts, react, and join discussion.</p>
                  <button
                    onClick={() => router.push("/login")}
                    className="w-full h-9 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold"
                  >
                    Login / Register
                  </button>
                </div>
              )}
            </div>

            {overview && (
              <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
                <div className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Top Improvement Themes</div>
                <div className="space-y-2">
                  {overview.topImprovementThemes.slice(0, 5).map((theme) => (
                    <div key={theme.theme} className="flex items-center justify-between text-xs">
                      <span className="text-white/70">{theme.theme}</span>
                      <span className="text-violet-300 font-semibold">{theme.count}</span>
                    </div>
                  ))}
                  {overview.topImprovementThemes.length === 0 && <p className="text-xs text-white/35">No improvement themes yet.</p>}
                </div>
              </div>
            )}
          </aside>

          <main className="flex-1 min-w-0 space-y-4">
            <section className="bg-white/3 border border-white/8 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3 text-xs text-white/35 uppercase tracking-wider">
                <Plus className="w-3 h-3" />
                Share a highlight
              </div>
              <div className="space-y-2">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="w-full h-10 bg-white/4 border border-white/8 rounded-xl px-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
                />
                <textarea
                  ref={textAreaRef}
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Share your mix insight, ask for feedback, or post a production win..."
                  className="w-full min-h-24 bg-white/4 border border-white/8 rounded-xl p-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 resize-none"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyFormat("**")}
                    className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white"
                  >
                    Bold
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormat("*")}
                    className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white"
                  >
                    Italic
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMedia((prev) => !prev)}
                    className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white flex items-center gap-1"
                  >
                    <ImageIcon className="w-3 h-3" />
                    Media
                  </button>
                </div>
                {showMedia && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="relative">
                      <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="Image URL"
                        className="w-full h-10 bg-white/4 border border-white/8 rounded-xl pl-10 pr-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
                      />
                    </div>
                    <div className="relative">
                      <Music className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        value={audioUrl}
                        onChange={(e) => setAudioUrl(e.target.value)}
                        placeholder="Audio URL"
                        className="w-full h-10 bg-white/4 border border-white/8 rounded-xl pl-10 pr-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/30">Markdown supported: **bold** and *italic*</span>
                  <button
                    onClick={() => void publishPost()}
                    disabled={!canPublish || submittingPost}
                    className="h-10 px-4 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold flex items-center gap-2"
                  >
                    {submittingPost ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Post
                  </button>
                </div>
              </div>
            </section>

            {loading ? (
              <div className="bg-white/3 border border-white/8 rounded-2xl p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-violet-300" />
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-white/3 border border-white/8 rounded-2xl p-8 text-center text-white/40">No posts yet. Be the first to share.</div>
            ) : (
              posts.map((post) => {
                const comparison = inferComparisonWinner(post);
                const trackId = post.analysis?.trackId;
                const timeline = trackId ? revisionChains[trackId] : undefined;
                const timelineLoading = trackId ? revisionLoading[trackId] : false;
                const timelineLoaded = trackId ? Object.prototype.hasOwnProperty.call(revisionChains, trackId) : false;

                return (
                  <article key={post.id} className="bg-[#0f0f0f] border border-white/6 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-xs font-bold text-violet-300">
                      {initials(post.author.userName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate">{post.author.userName}</div>
                      <div className="text-[11px] text-white/30">{formatTimeAgo(post.createdAt)}</div>
                    </div>
                    {post.analysisId && (
                      <span className="px-2 py-1 text-[10px] rounded-md bg-violet-500/10 border border-violet-500/25 text-violet-300">analysis linked</span>
                    )}
                    {comparison && (
                      <span
                        className={`px-2 py-1 text-[10px] rounded-md border ${
                          comparison.winner === "A"
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                            : comparison.winner === "B"
                              ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-200"
                              : "bg-amber-500/15 border-amber-500/40 text-amber-200"
                        }`}
                      >
                        A/B Winner: {comparison.winner === "tie" ? "Tie" : comparison.winner}
                      </span>
                    )}
                  </div>

                  {post.title && <h3 className="text-base font-semibold text-white mb-1">{post.title}</h3>}
                  {renderContent(post.content, post.contentFormat)}

                  {post.media?.length > 0 && (
                    <div className="mt-4 grid gap-3">
                      {post.media.map((media, idx) => (
                        <div key={`${media.type}-${idx}`}>
                          {media.type === "image" && (
                            <NextImage
                              src={resolveMediaUrl(media.url)}
                              alt={media.label ?? "post media"}
                              width={1200}
                              height={675}
                              unoptimized
                              className="w-full h-auto rounded-xl border border-white/10 object-cover"
                            />
                          )}
                          {media.type === "audio" && (
                            <audio controls className="w-full" src={resolveMediaUrl(media.url)} />
                          )}
                          {media.type === "link" && (
                            <a
                              href={media.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-violet-300 underline"
                            >
                              {media.label ?? media.url}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {post.analysis && (
                    <div
                      className={`mt-4 rounded-2xl border border-violet-500/20 bg-linear-to-br ${analysisBackdrop(
                        post.analysis.genre,
                      )} p-4 overflow-hidden relative`}
                    >
                      <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.25),transparent_60%)]" />
                      <div className="relative z-10">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[11px] uppercase tracking-widest text-violet-200/80 mb-1">Analysis Story</div>
                            <div className="text-sm font-semibold text-white">
                              {post.analysis.genre} {post.analysis.subgenre && <span className="text-white/60">- {post.analysis.subgenre}</span>}
                            </div>
                            <div className="text-[11px] text-white/60 mt-1">Confidence {post.analysis.confidence}%</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] uppercase text-white/40">Overall</div>
                            <div
                              className={`text-2xl font-bold ${scoreTone(
                                (post.analysis.commercialScore + post.analysis.productionScore + post.analysis.viralPotential) / 3,
                              )}`}
                            >
                              {((post.analysis.commercialScore + post.analysis.productionScore + post.analysis.viralPotential) / 3).toFixed(1)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-white/5 rounded-lg p-2 text-center">
                            <div className="text-white font-semibold">{post.analysis.commercialScore.toFixed(1)}</div>
                            <div className="text-white/40">Commercial</div>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2 text-center">
                            <div className="text-white font-semibold">{post.analysis.productionScore.toFixed(1)}</div>
                            <div className="text-white/40">Production</div>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2 text-center">
                            <div className="text-white font-semibold">{post.analysis.viralPotential.toFixed(1)}</div>
                            <div className="text-white/40">Viral</div>
                          </div>
                        </div>

                        {post.analysis.audioUrl && (
                          <audio className="w-full mt-3" controls src={resolveMediaUrl(post.analysis.audioUrl)} />
                        )}
                      </div>
                    </div>
                  )}

                  {trackId && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/3 p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="text-xs font-semibold text-white/60 uppercase tracking-widest">Revision Chain</div>
                        <button
                          onClick={() => void loadRevisionChain(trackId)}
                          className="text-[11px] text-violet-200 hover:text-white"
                        >
                          {timelineLoading ? "Loading..." : timelineLoaded ? "Refresh" : "Load"}
                        </button>
                      </div>
                      {!timelineLoaded ? (
                        <div className="text-xs text-white/40">Load revisions to see the evolution of this track.</div>
                      ) : timeline && timeline.length > 0 ? (
                        <ol className="space-y-2 text-xs text-white/70">
                          {timeline.map((rev, idx) => (
                            <li key={`${rev.trackId}-${idx}`} className="rounded-lg border border-white/10 bg-white/5 p-2">
                              <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
                                <span>Version {idx + 1}</span>
                                <span>{new Date(rev.uploadedAt).toLocaleDateString()}</span>
                              </div>
                              <div className="font-semibold text-white">{rev.trackName}</div>
                              <div className="text-white/50">
                                {rev.genre ? `${rev.genre}${rev.subgenre ? ` / ${rev.subgenre}` : ""}` : "Analysis pending"}
                              </div>
                              {rev.note && <div className="text-white/60 mt-1">Note: {rev.note}</div>}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <div className="text-xs text-white/40">No revisions linked yet.</div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-white/35">
                    {REACTIONS.map((reaction) => {
                      const Icon = reaction.icon;
                      const count = post.reactionCounts?.[reaction.key] ?? 0;
                      const active = post.currentUserReaction === reaction.key;
                      return (
                        <button
                          key={reaction.key}
                          onClick={() => void toggleReaction(post.id, reaction.key)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-full border transition-all ${
                            active
                              ? "border-violet-400/60 text-violet-200 bg-violet-500/20"
                              : "border-white/10 text-white/50 hover:text-white"
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${active ? "fill-current" : ""}`} />
                          <span className="text-[11px]">{count}</span>
                        </button>
                      );
                    })}
                    <span className="flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5" />
                      {post.commentCount}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/8 space-y-2">
                    {post.comments.slice(0, 3).map((comment) => (
                      <div key={comment.id} className="text-xs text-white/70">
                        <span className="font-semibold text-white/90">{comment.author.userName}:</span> {comment.content}
                      </div>
                    ))}

                    <div className="flex gap-2 pt-1">
                      <input
                        value={commentDrafts[post.id] || ""}
                        onChange={(e) =>
                          setCommentDrafts((prev) => ({
                            ...prev,
                            [post.id]: e.target.value,
                          }))
                        }
                        placeholder="Add a comment"
                        className="flex-1 h-9 bg-white/4 border border-white/8 rounded-xl px-3 text-xs focus:outline-none focus:border-white/20 placeholder:text-white/20"
                      />
                      <button
                        onClick={() => void submitComment(post.id)}
                        disabled={submittingCommentFor === post.id}
                        className="h-9 px-3 rounded-xl bg-white/7 hover:bg-white/12 disabled:opacity-50"
                      >
                        {submittingCommentFor === post.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </article>
                );
              })
            )}

            {posts.length > 0 && (
              <button
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="w-full h-11 border border-white/8 hover:border-white/20 hover:bg-white/3 rounded-xl text-sm text-white/60"
              >
                {loadingMore ? "Loading..." : "Load more posts"}
              </button>
            )}
          </main>

          <aside className="lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
            {overview && (
              <>
                <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
                  <div className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Community Stats</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/4 rounded-xl p-2.5 text-center">
                      <div className="text-lg font-bold text-white">{overview.community.activeUsers.toLocaleString()}</div>
                      <div className="text-[10px] text-white/30">Active Users</div>
                    </div>
                    <div className="bg-white/4 rounded-xl p-2.5 text-center">
                      <div className="text-lg font-bold text-white">{overview.analysis.totalTracks.toLocaleString()}</div>
                      <div className="text-[10px] text-white/30">Total Tracks</div>
                    </div>
                    <div className="bg-white/4 rounded-xl p-2.5 text-center">
                      <div className="text-lg font-bold text-white">{overview.social.totalComments.toLocaleString()}</div>
                      <div className="text-[10px] text-white/30">Comments</div>
                    </div>
                    <div className="bg-white/4 rounded-xl p-2.5 text-center">
                      <div className="text-lg font-bold text-violet-300">{overview.feedback.totalFeedback.toLocaleString()}</div>
                      <div className="text-[10px] text-white/30">Feedback</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
                  <div className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Top Genres</div>
                  <div className="space-y-2">
                    {overview.topGenres.slice(0, 5).map((genre) => (
                      <div key={genre.genre} className="flex items-center justify-between text-xs">
                        <span className="text-white/75">{genre.genre}</span>
                        <span className="text-emerald-300">{genre.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
                  <div className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Musicle AI Suggestions</div>
                  <div className="space-y-2.5">
                    {overview.suggestions.map((suggestion, index) => (
                      <div key={`${suggestion.title}-${index}`} className="rounded-xl border border-white/8 bg-white/3 p-2.5">
                        <div className="text-xs font-semibold text-white">{suggestion.title}</div>
                        <div className="text-[11px] text-white/45 mt-1">{suggestion.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
                  <div className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Recent Feedback</div>
                  <div className="space-y-2">
                    {overview.recentFeedback.slice(0, 4).map((feedback) => (
                      <div key={feedback.feedbackId} className="text-xs text-white/60">
                        <div className="font-medium text-white/80">{feedback.correctedGenre || "No genre correction"}</div>
                        <div className="text-[11px] text-white/35">{feedback.notesPreview || "No note"}</div>
                      </div>
                    ))}
                    {overview.recentFeedback.length === 0 && <div className="text-xs text-white/35">No feedback submitted yet.</div>}
                  </div>
                </div>

                {trendRadar && (
                  <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
                    <div className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Trend Radar</div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-[11px] text-white/40 mb-2">Top Issues</div>
                        <div className="space-y-1">
                          {trendRadar.topIssues.slice(0, 4).map((item) => (
                            <div key={item.label} className="flex items-center justify-between text-xs">
                              <span className="text-white/70">{item.label}</span>
                              <span className="text-rose-300">{item.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-white/40 mb-2">Top Wins</div>
                        <div className="space-y-1">
                          {trendRadar.topWins.slice(0, 4).map((item) => (
                            <div key={item.label} className="flex items-center justify-between text-xs">
                              <span className="text-white/70">{item.label}</span>
                              <span className="text-emerald-300">{item.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {leaderboard && (
                  <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
                    <div className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Feedback Reputation</div>
                    <div className="space-y-2">
                      {leaderboard.entries.slice(0, 5).map((entry, index) => (
                        <div key={entry.userId} className="flex items-center justify-between text-xs">
                          <span className="text-white/70">
                            {index + 1}. {entry.userName}
                          </span>
                          <span className="text-violet-300">{entry.reputationScore.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {!overview && !loading && (
              <div className="bg-white/3 border border-white/6 rounded-2xl p-4 text-sm text-white/45">Dashboard data unavailable.</div>
            )}
          </aside>
        </div>
      </div>

      <div className="fixed bottom-6 left-6 right-6 pointer-events-none hidden lg:flex justify-between text-[11px] text-white/25">
        <span className="flex items-center gap-1.5 pointer-events-auto bg-black/40 border border-white/10 rounded-full px-3 py-1.5">
          <Users className="w-3 h-3" />
          Real-time users: {overview?.community.activeUsers ?? 0}
        </span>
        <span className="flex items-center gap-1.5 pointer-events-auto bg-black/40 border border-white/10 rounded-full px-3 py-1.5">
          <Activity className="w-3 h-3" />
          Tracks analyzed today: {overview?.analysis.tracksAnalyzedToday ?? 0}
        </span>
        <span className="flex items-center gap-1.5 pointer-events-auto bg-black/40 border border-white/10 rounded-full px-3 py-1.5">
          <TrendingUp className="w-3 h-3" />
          Avg confidence: {overview?.analysis.averageConfidence ?? 0}%
        </span>
        <span className="flex items-center gap-1.5 pointer-events-auto bg-black/40 border border-white/10 rounded-full px-3 py-1.5">
          <Sparkles className="w-3 h-3" />
          Musicle AI live
        </span>
      </div>
    </div>
  );
}
