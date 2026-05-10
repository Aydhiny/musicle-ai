export function getApiBaseUrl(): string {
  const root = (process.env.NEXT_PUBLIC_API_URL || "https://localhost:5001").replace(/\/+$/, "");
  if (root.endsWith("/api")) {
    return root;
  }
  return `${root}/api`;
}

export function resolveApiUrl(path: string): string {
  const base = getApiBaseUrl();
  if (!path) {
    return base;
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/api" || normalized === "/api/") {
    return base;
  }
  if (normalized.startsWith("/api/")) {
    return `${base}${normalized.slice(4)}`;
  }
  return `${base}${normalized}`;
}
