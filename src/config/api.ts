const API_BASE_URL = ((import.meta as any).env?.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}
