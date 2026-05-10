import { resolveApiUrl } from "@/lib/api-url";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "https://localhost:5001").replace(/\/+$/, "");

export interface ApiErrorPayload {
  error?: string;
  message?: string;
}

export interface UserSettings {
  publicProfile: boolean;
  emailNotifications: boolean;
  showActivityStatus: boolean;
  theme: string;
}

export interface AuthUser {
  id: string;
  userName: string;
  email: string;
  bio?: string | null;
  settings?: UserSettings;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  expiresAtUtc: string;
  user: AuthUser;
}

export interface RegisterRequest {
  userName: string;
  email: string;
  password: string;
  bio?: string;
}

export interface LoginRequest {
  login: string;
  password: string;
}

export interface UpdateProfileRequest {
  userName?: string;
  email?: string;
  bio?: string | null;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateSettingsRequest {
  settings: UserSettings;
}

export interface SocialUserSummary {
  id: string;
  userName: string;
  bio?: string | null;
}

export interface PostComment {
  id: string;
  postId: string;
  parentCommentId?: string | null;
  author: SocialUserSummary;
  content: string;
  likeCount: number;
  isLikedByCurrentUser: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PostMedia {
  type: string;
  url: string;
  label?: string | null;
  contentType?: string | null;
  durationSeconds?: number | null;
}

export interface AnalysisShare {
  analysisId: string;
  trackId: string;
  genre: string;
  subgenre: string;
  confidence: number;
  commercialScore: number;
  productionScore: number;
  viralPotential: number;
  analyzedAt: string;
  audioUrl?: string | null;
}

export interface HighlightPost {
  id: string;
  analysisId?: string | null;
  author: SocialUserSummary;
  title?: string | null;
  content: string;
  contentFormat: string;
  media: PostMedia[];
  analysis?: AnalysisShare | null;
  likeCount: number;
  isLikedByCurrentUser: boolean;
  commentCount: number;
  reactionCounts: Record<string, number>;
  currentUserReaction?: string | null;
  createdAt: string;
  updatedAt: string;
  comments: PostComment[];
}

export interface HighlightsFeedResponse {
  page: number;
  pageSize: number;
  posts: HighlightPost[];
}

export interface ToggleLikeResult {
  targetId: string;
  targetType: string;
  isLiked: boolean;
  totalLikes: number;
}

export interface ToggleReactionResult {
  postId: string;
  reaction: string;
  isActive: boolean;
  reactionCounts: Record<string, number>;
}

export interface CommunityCounts {
  totalUsers: number;
  activeUsers: number;
  activeUsersLast30Days: number;
}

export interface AnalysisSnapshot {
  totalTracks: number;
  completedTracks: number;
  processingTracks: number;
  queuedTracks: number;
  tracksAnalyzedToday: number;
  tracksAnalyzedThisWeek: number;
  averageConfidence: number;
  averageCommercialScore: number;
  averageProductionScore: number;
  averageViralPotential: number;
}

export interface SocialSnapshot {
  totalPosts: number;
  totalComments: number;
  totalPostLikes: number;
  totalCommentLikes: number;
}

export interface FeedbackSnapshot {
  totalFeedback: number;
  pendingFeedback: number;
  usedInTraining: number;
  averageAccuracyRating: number;
}

export interface GenreCount {
  genre: string;
  count: number;
}

export interface ThemeCount {
  theme: string;
  count: number;
}

export interface AiSuggestion {
  title: string;
  description: string;
  severity: "info" | "warning" | "success" | string;
}

export interface AiInsight {
  headline: string;
  summary: string;
  suggestedAction: string;
}

export interface RecentComment {
  commentId: string;
  postId: string;
  authorUserName: string;
  contentPreview: string;
  createdAt: string;
}

export interface RecentFeedback {
  feedbackId: string;
  analysisId: string;
  correctedGenre?: string | null;
  accuracyRating?: number | null;
  notesPreview?: string | null;
  submittedAt: string;
}

export interface TrendItem {
  label: string;
  count: number;
}

export interface TrendRadar {
  generatedAtUtc: string;
  topIssues: TrendItem[];
  topWins: TrendItem[];
}

export interface FeedbackLeaderboardEntry {
  userId: string;
  userName: string;
  feedbackCount: number;
  averageAccuracy: number;
  reputationScore: number;
}

export interface FeedbackLeaderboard {
  generatedAtUtc: string;
  entries: FeedbackLeaderboardEntry[];
}

export interface WaveformComment {
  id: string;
  trackId: string;
  authorId: string;
  authorUserName: string;
  timeSeconds: number;
  content: string;
  createdAt: string;
}

export interface TrackRevision {
  trackId: string;
  trackName: string;
  analysisId?: string | null;
  genre?: string | null;
  subgenre?: string | null;
  confidence?: number | null;
  uploadedAt: string;
  note?: string | null;
}

export interface ComparisonStats {
  trackAId: string;
  trackBId: string;
  votesForTrackA: number;
  votesForTrackB: number;
  totalVotes: number;
}

export interface AdminPost {
  id: string;
  analysisId?: string | null;
  title?: string | null;
  contentPreview: string;
  contentFormat: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  authorUserName: string;
  commentCount: number;
  likeCount: number;
  reactionCount: number;
}

export interface AdminPostsResponse {
  page: number;
  pageSize: number;
  total: number;
  posts: AdminPost[];
}

export interface AdminComment {
  id: string;
  postId: string;
  parentCommentId?: string | null;
  contentPreview: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  authorUserName: string;
  postTitle?: string | null;
}

export interface AdminCommentsResponse {
  page: number;
  pageSize: number;
  total: number;
  comments: AdminComment[];
}

export interface AdminWaveformComment {
  id: string;
  trackId: string;
  authorUserName: string;
  timeSeconds: number;
  content: string;
  createdAt: string;
}

export interface AdminWaveformCommentsResponse {
  page: number;
  pageSize: number;
  total: number;
  comments: AdminWaveformComment[];
}

export interface DashboardOverview {
  generatedAtUtc: string;
  community: CommunityCounts;
  analysis: AnalysisSnapshot;
  social: SocialSnapshot;
  feedback: FeedbackSnapshot;
  topGenres: GenreCount[];
  topImprovementThemes: ThemeCount[];
  suggestions: AiSuggestion[];
  insight: AiInsight;
  recentComments: RecentComment[];
  recentFeedback: RecentFeedback[];
}

export interface UserRecentPost {
  postId: string;
  contentPreview: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
}

export interface UserDashboard {
  userId: string;
  userName: string;
  email: string;
  memberSince: string;
  lastLoginAt?: string | null;
  postsPublished: number;
  commentsWritten: number;
  postsLiked: number;
  commentsLiked: number;
  postLikesReceived: number;
  commentLikesReceived: number;
  engagementScore: number;
  recentPosts: UserRecentPost[];
}

export interface CreateHighlightPostInput {
  title?: string;
  content: string;
  contentFormat?: string;
  analysisId?: string | null;
  media?: PostMedia[];
}

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const url = resolveApiUrl(path);
  const headers = new Headers(init?.headers ?? {});

  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null;

    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = null;
    }

    const message = payload?.error || payload?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function adminHeaders(adminToken: string): Headers {
  const headers = new Headers();
  headers.set("X-Admin-Token", adminToken);
  return headers;
}

export async function register(requestBody: RegisterRequest): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export async function login(requestBody: LoginRequest): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export async function getMyProfile(token: string): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/me", undefined, token);
}

export async function updateProfile(requestBody: UpdateProfileRequest, token: string): Promise<AuthUser> {
  return request<AuthUser>(
    "/api/auth/profile",
    {
      method: "PUT",
      body: JSON.stringify(requestBody),
    },
    token,
  );
}

export async function updateSettings(requestBody: UpdateSettingsRequest, token: string): Promise<AuthUser> {
  return request<AuthUser>(
    "/api/auth/settings",
    {
      method: "PUT",
      body: JSON.stringify(requestBody),
    },
    token,
  );
}

export async function changePassword(requestBody: ChangePasswordRequest, token: string): Promise<void> {
  await request<void>(
    "/api/auth/password",
    {
      method: "PUT",
      body: JSON.stringify(requestBody),
    },
    token,
  );
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  return request<DashboardOverview>("/api/dashboard/overview");
}

export async function getTrendRadar(): Promise<TrendRadar> {
  return request<TrendRadar>("/api/dashboard/trends");
}

export async function getFeedbackLeaderboard(take: number = 10): Promise<FeedbackLeaderboard> {
  return request<FeedbackLeaderboard>(`/api/dashboard/feedback-leaderboard?take=${take}`);
}

export async function getMyDashboard(token: string): Promise<UserDashboard> {
  return request<UserDashboard>("/api/dashboard/me", undefined, token);
}

export async function getHighlightsFeed(
  page: number = 1,
  pageSize: number = 20,
  token?: string,
  mode: "recent" | "trending" | "for-you" = "recent",
): Promise<HighlightsFeedResponse> {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    mode,
  });

  return request<HighlightsFeedResponse>(`/api/highlights/feed?${query.toString()}`, undefined, token);
}

export async function createHighlightPost(input: CreateHighlightPostInput, token: string): Promise<HighlightPost> {
  return request<HighlightPost>(
    "/api/highlights",
    {
      method: "POST",
      body: JSON.stringify({
        title: input.title ?? null,
        content: input.content,
        contentFormat: input.contentFormat ?? "markdown",
        analysisId: input.analysisId ?? null,
        media: input.media ?? [],
      }),
    },
    token,
  );
}

export async function togglePostLike(postId: string, token: string): Promise<ToggleLikeResult> {
  return request<ToggleLikeResult>(`/api/highlights/${postId}/likes/toggle`, { method: "POST" }, token);
}

export async function togglePostReaction(postId: string, reaction: string, token: string): Promise<ToggleReactionResult> {
  return request<ToggleReactionResult>(
    `/api/highlights/${postId}/reactions/toggle`,
    {
      method: "POST",
      body: JSON.stringify({ reaction }),
    },
    token,
  );
}

export async function addCommentToPost(postId: string, content: string, token: string, parentCommentId?: string): Promise<PostComment> {
  return request<PostComment>(
    `/api/highlights/${postId}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ content, parentCommentId: parentCommentId || null }),
    },
    token,
  );
}

export interface SubmitFeedbackPayload {
  analysisId: string;
  correctedGenre?: string;
  correctedSubgenre?: string;
  accuracyRating?: number;
  correctedCommercialScore?: number;
  correctedProductionScore?: number;
  correctedViralPotential?: number;
  notes?: string;
}

export async function submitFeedback(payload: SubmitFeedbackPayload): Promise<void> {
  await request<void>("/api/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface SketchAuthorDto {
  id: string;
  userName: string;
  bio?: string | null;
}

export interface SketchViewDto {
  id: string;
  author: SketchAuthorDto;
  name: string;
  type: string;
  durationSeconds: number;
  bpm?: number | null;
  key?: string | null;
  scale?: string | null;
  tags: string[];
  waveform: number[];
  hue: string;
  isAi: boolean;
  isFavorite: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  audioUrl?: string | null;
}

export interface SketchFeedResultDto {
  page: number;
  pageSize: number;
  totalCount: number;
  sketches: SketchViewDto[];
}

export interface ToggleSketchFavoriteDto {
  sketchId: string;
  isFavorite: boolean;
}

export async function getSketchFeed(page: number = 1, pageSize: number = 24): Promise<SketchFeedResultDto> {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  return request<SketchFeedResultDto>(`/api/sketches/feed?${query.toString()}`);
}

export async function getWaveformComments(trackId: string): Promise<WaveformComment[]> {
  const response = await request<{ comments: WaveformComment[] }>(`/api/analysis/${trackId}/comments`);
  return response.comments || [];
}

export async function addWaveformComment(
  trackId: string,
  payload: { timeSeconds: number; content: string },
  token: string,
): Promise<WaveformComment> {
  return request<WaveformComment>(
    `/api/analysis/${trackId}/comments`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export async function getTrackTimeline(trackId: string): Promise<TrackRevision[]> {
  const response = await request<{ timeline: TrackRevision[] }>(`/api/analysis/${trackId}/timeline`);
  return response.timeline || [];
}

export async function createTrackRevision(
  trackId: string,
  payload: { previousTrackId: string; note?: string },
  token: string,
): Promise<TrackRevision[]> {
  const response = await request<{ timeline: TrackRevision[] }>(
    `/api/analysis/${trackId}/revision`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
  return response.timeline || [];
}

export async function getComparisonStats(trackAId: string, trackBId: string): Promise<ComparisonStats> {
  return request<ComparisonStats>(`/api/comparisons/${trackAId}/${trackBId}`);
}

export async function submitComparisonVote(
  trackAId: string,
  trackBId: string,
  winnerTrackId: string,
  token: string,
): Promise<void> {
  await request<void>(
    "/api/comparisons/vote",
    {
      method: "POST",
      body: JSON.stringify({ trackAId, trackBId, winnerTrackId }),
    },
    token,
  );
}

export async function getMySketches(token: string, page: number = 1, pageSize: number = 50, type?: string): Promise<SketchFeedResultDto> {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (type) {
    query.set("type", type);
  }

  return request<SketchFeedResultDto>(`/api/sketches/mine?${query.toString()}`, undefined, token);
}

export async function uploadSketch(formData: FormData, token: string): Promise<SketchViewDto> {
  return request<SketchViewDto>(
    "/api/sketches/upload",
    {
      method: "POST",
      body: formData,
    },
    token,
  );
}

export async function toggleSketchFavorite(sketchId: string, token: string): Promise<ToggleSketchFavoriteDto> {
  return request<ToggleSketchFavoriteDto>(`/api/sketches/${sketchId}/favorite`, { method: "POST" }, token);
}

export async function deleteSketch(sketchId: string, token: string): Promise<void> {
  await request<void>(`/api/sketches/${sketchId}`, { method: "DELETE" }, token);
}

export async function getAdminPosts(
  adminToken: string,
  page: number = 1,
  pageSize: number = 30,
  includeDeleted: boolean = false,
  search?: string,
): Promise<AdminPostsResponse> {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    includeDeleted: String(includeDeleted),
  });

  if (search) {
    query.set("search", search);
  }

  return request<AdminPostsResponse>(`/api/admin/moderation/posts?${query.toString()}`, { headers: adminHeaders(adminToken) });
}

export async function deleteAdminPost(adminToken: string, postId: string): Promise<void> {
  await request<void>(
    `/api/admin/moderation/posts/${postId}/delete`,
    { method: "POST", headers: adminHeaders(adminToken) },
  );
}

export async function getAdminComments(
  adminToken: string,
  page: number = 1,
  pageSize: number = 40,
  includeDeleted: boolean = false,
  search?: string,
): Promise<AdminCommentsResponse> {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    includeDeleted: String(includeDeleted),
  });

  if (search) {
    query.set("search", search);
  }

  return request<AdminCommentsResponse>(`/api/admin/moderation/comments?${query.toString()}`, { headers: adminHeaders(adminToken) });
}

export async function deleteAdminComment(adminToken: string, commentId: string): Promise<void> {
  await request<void>(
    `/api/admin/moderation/comments/${commentId}/delete`,
    { method: "POST", headers: adminHeaders(adminToken) },
  );
}

export async function getAdminWaveformComments(
  adminToken: string,
  page: number = 1,
  pageSize: number = 40,
  search?: string,
): Promise<AdminWaveformCommentsResponse> {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (search) {
    query.set("search", search);
  }

  return request<AdminWaveformCommentsResponse>(`/api/admin/moderation/waveform-comments?${query.toString()}`, { headers: adminHeaders(adminToken) });
}

export async function deleteAdminWaveformComment(adminToken: string, commentId: string): Promise<void> {
  await request<void>(
    `/api/admin/moderation/waveform-comments/${commentId}/delete`,
    { method: "POST", headers: adminHeaders(adminToken) },
  );
}
