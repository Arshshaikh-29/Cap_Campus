import axios from "axios";
import type { BookmarkedItem } from "@/components/NavigationShell";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const AUTH_STORAGE_KEY = "cap_compass_google_auth_v1";

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  role?: "student" | "counsellor" | "admin" | "super_admin";
  is_active?: boolean;
  saved_input_type: "percentile" | "rank";
  saved_score?: number | null;
  saved_category: string;
  bookmarks: BookmarkedItem[];
  last_login_at?: string | null;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export function getStoredAuth(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.token === "string" &&
      parsed.token.startsWith("v1.") &&
      parsed.user &&
      typeof parsed.user.email === "string"
    ) {
      return parsed as AuthSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredAuth(session: AuthSession) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    window.dispatchEvent(new Event("cap_auth_updated"));
  } catch {
    // ignore storage errors
  }
}

export function clearStoredAuth() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new Event("cap_auth_updated"));
  } catch {
    // ignore storage errors
  }
}

export async function logoutFromServer(): Promise<void> {
  const session = getStoredAuth();
  clearStoredAuth();
  if (!session?.token) return;
  try {
    await axios.post(
      `${API_BASE}/auth/logout`,
      {},
      { headers: { Authorization: `Bearer ${session.token}` } }
    );
  } catch {
    // non-blocking: client token is already purged
  }
}

export function mergeBookmarks(
  localItems: BookmarkedItem[],
  cloudItems: BookmarkedItem[]
): BookmarkedItem[] {
  const map = new Map<string, BookmarkedItem>();
  for (const item of [...(cloudItems || []), ...(localItems || [])]) {
    if (item && item.key) {
      map.set(item.key, item);
    }
  }
  return Array.from(map.values()).slice(0, 60);
}

export async function syncProfileToCloud(payload: {
  saved_input_type?: "percentile" | "rank";
  saved_score?: number | null;
  saved_category?: string;
  bookmarks?: BookmarkedItem[];
}): Promise<AuthUser | null> {
  const session = getStoredAuth();
  if (!session?.token) return null;
  const res = await axios.post(`${API_BASE}/auth/sync`, payload, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (res.data?.user) {
    saveStoredAuth({ token: session.token, user: res.data.user });
    return res.data.user as AuthUser;
  }
  return null;
}
