"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminComment,
  AdminPost,
  AdminWaveformComment,
  deleteAdminComment,
  deleteAdminPost,
  deleteAdminWaveformComment,
  getAdminComments,
  getAdminPosts,
  getAdminWaveformComments,
} from "@/services/backendApi";
import { AlertTriangle, Loader2, Shield, Trash2 } from "lucide-react";

type TabKey = "posts" | "comments" | "waveform";

const TABS: { key: TabKey; label: string }[] = [
  { key: "posts", label: "Posts" },
  { key: "comments", label: "Comments" },
  { key: "waveform", label: "Waveform" },
];

export default function AdminModerationPage() {
  const [adminToken, setAdminToken] = useState("");
  const [tab, setTab] = useState<TabKey>("posts");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [waveformComments, setWaveformComments] = useState<AdminWaveformComment[]>([]);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("musicle_admin_token") : null;
    if (stored) {
      setAdminToken(stored);
    }
  }, []);

  useEffect(() => {
    if (adminToken) {
      window.localStorage.setItem("musicle_admin_token", adminToken);
    }
  }, [adminToken]);

  const canQuery = useMemo(() => adminToken.trim().length > 8, [adminToken]);

  const refresh = useCallback(async () => {
    if (!canQuery) {
      setError("Enter a valid admin token to load moderation data.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (tab === "posts") {
        const res = await getAdminPosts(adminToken.trim(), 1, 40, includeDeleted, search.trim() || undefined);
        setPosts(res.posts);
      } else if (tab === "comments") {
        const res = await getAdminComments(adminToken.trim(), 1, 50, includeDeleted, search.trim() || undefined);
        setComments(res.comments);
      } else {
        const res = await getAdminWaveformComments(adminToken.trim(), 1, 60, search.trim() || undefined);
        setWaveformComments(res.comments);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load moderation data.");
    } finally {
      setLoading(false);
    }
  }, [adminToken, canQuery, includeDeleted, search, tab]);

  useEffect(() => {
    if (canQuery) {
      void refresh();
    }
  }, [canQuery, refresh]);

  const handleDeletePost = async (postId: string) => {
    if (!canQuery) return;
    if (!window.confirm("Delete this post? This is a soft delete.")) return;

    setLoading(true);
    try {
      await deleteAdminPost(adminToken.trim(), postId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete post.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!canQuery) return;
    if (!window.confirm("Delete this comment? This is a soft delete.")) return;

    setLoading(true);
    try {
      await deleteAdminComment(adminToken.trim(), commentId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete comment.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWaveform = async (commentId: string) => {
    if (!canQuery) return;
    if (!window.confirm("Delete this waveform comment? This is permanent.")) return;

    setLoading(true);
    try {
      await deleteAdminWaveformComment(adminToken.trim(), commentId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete waveform comment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen mt-24 text-white" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Admin Moderation</h1>
            <p className="text-sm text-white/40 mt-1">Audit posts, comments, and waveform feedback in real time.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Shield className="w-4 h-4 text-violet-300" />
            Restricted access
          </div>
        </div>

        <div className="bg-white/3 border border-white/8 rounded-2xl p-4 mb-6">
          <label className="block text-xs text-white/50 mb-2">Admin Token</label>
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <input
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder="Paste the Admin:Token from appsettings"
              className="flex-1 h-10 bg-white/5 border border-white/10 rounded-xl px-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/50"
            />
            <button
              onClick={() => void refresh()}
              className="h-10 px-4 rounded-xl bg-violet-500/20 border border-violet-500/40 text-sm font-semibold text-violet-100 hover:bg-violet-500/30"
            >
              Refresh
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/40">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
                className="accent-violet-400"
              />
              Include deleted
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by author, title, or content"
              className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/50"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-5">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`h-9 px-4 rounded-xl text-xs font-semibold border transition-all ${
                tab === item.key
                  ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                  : "bg-white/5 border-white/10 text-white/50 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/3 p-6 text-sm text-white/50 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading moderation data...
          </div>
        ) : tab === "posts" ? (
          <div className="space-y-3">
            {posts.length === 0 && <div className="text-sm text-white/40">No posts found.</div>}
            {posts.map((post) => (
              <div key={post.id} className="rounded-2xl border border-white/10 bg-white/3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="text-sm font-semibold text-white">{post.title || "Untitled post"}</div>
                    <div className="text-xs text-white/40">
                      by @{post.authorUserName} · {new Date(post.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="h-8 px-3 rounded-lg text-xs font-semibold bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
                <p className="text-sm text-white/70">{post.contentPreview}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-white/40">
                  <span>Comments: {post.commentCount}</span>
                  <span>Likes: {post.likeCount}</span>
                  <span>Reactions: {post.reactionCount}</span>
                  {post.isDeleted && <span className="text-rose-300">Deleted</span>}
                </div>
              </div>
            ))}
          </div>
        ) : tab === "comments" ? (
          <div className="space-y-3">
            {comments.length === 0 && <div className="text-sm text-white/40">No comments found.</div>}
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-2xl border border-white/10 bg-white/3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="text-sm font-semibold text-white">@{comment.authorUserName}</div>
                    <div className="text-xs text-white/40">
                      {comment.postTitle || "Untitled post"} · {new Date(comment.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="h-8 px-3 rounded-lg text-xs font-semibold bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
                <p className="text-sm text-white/70">{comment.contentPreview}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-white/40">
                  <span>Post ID: {comment.postId}</span>
                  {comment.isDeleted && <span className="text-rose-300">Deleted</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {waveformComments.length === 0 && <div className="text-sm text-white/40">No waveform comments found.</div>}
            {waveformComments.map((comment) => (
              <div key={comment.id} className="rounded-2xl border border-white/10 bg-white/3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="text-sm font-semibold text-white">@{comment.authorUserName}</div>
                    <div className="text-xs text-white/40">
                      Track {comment.trackId} · {new Date(comment.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteWaveform(comment.id)}
                    className="h-8 px-3 rounded-lg text-xs font-semibold bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
                <p className="text-xs text-white/60 mb-1">Time: {comment.timeSeconds.toFixed(1)}s</p>
                <p className="text-sm text-white/70">{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
