"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  changePassword,
  getMyDashboard,
  getMyProfile,
  updateProfile,
  updateSettings,
  UserDashboard,
  UserSettings,
} from "@/services/backendApi";
import { Loader2, Save, Shield, User as UserIcon, Settings as SettingsIcon } from "lucide-react";

const DEFAULT_SETTINGS: UserSettings = {
  publicProfile: true,
  emailNotifications: true,
  showActivityStatus: true,
  theme: "dark",
};

export default function DashboardPage() {
  const router = useRouter();
  const { token, loading, refreshProfile } = useAuth();

  const [dashboard, setDashboard] = useState<UserDashboard | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState({ userName: "", email: "", bio: "" });
  const [settingsForm, setSettingsForm] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !token) {
      router.push("/login");
      return;
    }

    if (!token) {
      return;
    }

    const load = async () => {
      setLoadingData(true);
      setError(null);
      try {
        const [profileResponse, dashboardResponse] = await Promise.all([getMyProfile(token), getMyDashboard(token)]);
        setDashboard(dashboardResponse);
        setProfileForm({
          userName: profileResponse.userName,
          email: profileResponse.email,
          bio: profileResponse.bio ?? "",
        });
        setSettingsForm(profileResponse.settings ?? DEFAULT_SETTINGS);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard.");
      } finally {
        setLoadingData(false);
      }
    };

    void load();
  }, [loading, token, router]);

  const handleProfileSave = async () => {
    if (!token) return;
    setSavingProfile(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await updateProfile(
        {
          userName: profileForm.userName,
          email: profileForm.email,
          bio: profileForm.bio,
        },
        token,
      );
      setSuccessMessage("Profile updated.");
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSettingsSave = async () => {
    if (!token) return;
    setSavingSettings(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await updateSettings({ settings: settingsForm }, token);
      setSuccessMessage("Settings saved.");
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!token) return;
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setError("Fill out all password fields.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setSavingPassword(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await changePassword(
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
        token,
      );
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSuccessMessage("Password updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen mt-24 flex items-center justify-center text-white">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen mt-24 text-white" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Your Dashboard</h1>
          <p className="text-sm text-white/40 mt-1">Manage your profile, security, and Musicle preferences.</p>
        </div>

        {(error || successMessage) && (
          <div
            className={`rounded-xl border p-3 text-sm ${
              error ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {error ?? successMessage}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white/3 border border-white/6 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <UserIcon className="w-4 h-4 text-violet-300" />
                Profile
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-white/40">Username</label>
                  <input
                    value={profileForm.userName}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, userName: e.target.value }))}
                    className="w-full h-10 mt-1 bg-white/5 border border-white/10 rounded-xl px-3 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40">Email</label>
                  <input
                    value={profileForm.email}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full h-10 mt-1 bg-white/5 border border-white/10 rounded-xl px-3 text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40">Bio</label>
                <textarea
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, bio: e.target.value }))}
                  className="w-full mt-1 min-h-20 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>
              <button
                onClick={handleProfileSave}
                disabled={savingProfile}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-500/80 hover:bg-violet-500 text-sm font-semibold disabled:opacity-60"
              >
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Profile
              </button>
            </section>

            <section className="bg-white/3 border border-white/6 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <SettingsIcon className="w-4 h-4 text-violet-300" />
                Preferences
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-white/70">
                  <input
                    type="checkbox"
                    checked={settingsForm.publicProfile}
                    onChange={(e) => setSettingsForm((prev) => ({ ...prev, publicProfile: e.target.checked }))}
                  />
                  Public profile
                </label>
                <label className="flex items-center gap-2 text-sm text-white/70">
                  <input
                    type="checkbox"
                    checked={settingsForm.emailNotifications}
                    onChange={(e) => setSettingsForm((prev) => ({ ...prev, emailNotifications: e.target.checked }))}
                  />
                  Email notifications
                </label>
                <label className="flex items-center gap-2 text-sm text-white/70">
                  <input
                    type="checkbox"
                    checked={settingsForm.showActivityStatus}
                    onChange={(e) => setSettingsForm((prev) => ({ ...prev, showActivityStatus: e.target.checked }))}
                  />
                  Show activity status
                </label>
                <div>
                  <label className="text-xs text-white/40">Theme</label>
                  <select
                    value={settingsForm.theme}
                    onChange={(e) => setSettingsForm((prev) => ({ ...prev, theme: e.target.value }))}
                    className="w-full h-10 mt-1 bg-white/5 border border-white/10 rounded-xl px-3 text-sm text-white"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleSettingsSave}
                disabled={savingSettings}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold disabled:opacity-60"
              >
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Settings
              </button>
            </section>

            <section className="bg-white/3 border border-white/6 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Shield className="w-4 h-4 text-violet-300" />
                Security
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-white/40">Current password</label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    className="w-full h-10 mt-1 bg-white/5 border border-white/10 rounded-xl px-3 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40">New password</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full h-10 mt-1 bg-white/5 border border-white/10 rounded-xl px-3 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40">Confirm new password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full h-10 mt-1 bg-white/5 border border-white/10 rounded-xl px-3 text-sm text-white"
                  />
                </div>
              </div>
              <button
                onClick={handlePasswordSave}
                disabled={savingPassword}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-rose-500/70 hover:bg-rose-500 text-sm font-semibold disabled:opacity-60"
              >
                {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Update Password
              </button>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="bg-white/3 border border-white/6 rounded-2xl p-5">
              <div className="text-xs text-white/40 uppercase tracking-wider">At a glance</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-white">{dashboard?.postsPublished ?? 0}</div>
                  <div className="text-[10px] text-white/40">Posts</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-white">{dashboard?.commentsWritten ?? 0}</div>
                  <div className="text-[10px] text-white/40">Comments</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-white">{dashboard?.postLikesReceived ?? 0}</div>
                  <div className="text-[10px] text-white/40">Reactions</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-violet-300">{dashboard?.engagementScore ?? 0}</div>
                  <div className="text-[10px] text-white/40">Engagement</div>
                </div>
              </div>
            </section>

            <section className="bg-white/3 border border-white/6 rounded-2xl p-5">
              <div className="text-xs text-white/40 uppercase tracking-wider">Recent posts</div>
              <div className="mt-3 space-y-2">
                {(dashboard?.recentPosts ?? []).map((post) => (
                  <div key={post.postId} className="text-xs text-white/70">
                    <div className="font-medium text-white/80">{post.contentPreview}</div>
                    <div className="text-[10px] text-white/40">{new Date(post.createdAt).toLocaleDateString()}</div>
                  </div>
                ))}
                {(dashboard?.recentPosts?.length ?? 0) === 0 && <div className="text-xs text-white/40">No posts yet.</div>}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
