"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import {
  claimApi,
  getMeApi,
  loginApi,
  loginViaSupabaseApi,
  logoutApi,
  refreshSessionApi,
} from "../lib/api/auth";
import { setAccessToken } from "../lib/api/client";

export interface ScopeMembership {
  project_id?: string;
  project_name?: string;
  department_id?: string;
  department_name?: string;
  is_head?: boolean;
  is_finance?: boolean;
  is_manager?: boolean;
}

export interface Scope {
  memberships?: ScopeMembership[];
  head_of?: string[];
  finance_of?: string[];
  manager_of?: string[];
}

export interface AuthUser {
  _id?: string;
  nickname?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
  signature_image?: string | null;
  scope?: Scope;
}

/**
 * Why /auth/me couldn't be loaded, when the reason is *not* "signed out". Consumers render
 * this so a broken backend is distinguishable from a missing session.
 */
export interface AuthError {
  kind: "server" | "network";
  status?: number;
  message: string;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  /** Machine-readable code from the API error envelope ({ error: { code, message } }).
   *  Callers branch on ACCOUNT_NOT_CLAIMED to send the user to the claim form. */
  code?: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  /** Non-null when the last profile load failed for a reason other than being signed out. */
  authError: AuthError | null;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<LoginResult>;
  /** Trades a Supabase Auth access token (from the Google redirect) for one of our sessions. */
  loginWithSupabase: (supabaseAccessToken: string) => Promise<LoginResult>;
  /** First login: sets the password and signs the user in with the session /auth/claim returns. */
  claimAccount: (password: string, supabaseAccessToken: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<AuthError | null>(null);

  const MOCK_DEV_USER: AuthUser = {
    _id: "018f6a2e-dev-admin",
    nickname: "Golf (Dev Admin)",
    first_name: "สมชาย",
    last_name: "ใจดี",
    email: "golf@tcos.app",
    role: "admin",
    signature_image: "https://mock.tcos.app/signatures/golf.png",
    scope: {
      memberships: [
        {
          project_id: "p1",
          project_name: "The Coming of Stages 3",
          department_id: "d1",
          department_name: "ฝ่ายการเงิน",
          is_head: true,
          is_finance: true,
          is_manager: true,
        },
      ],
      head_of: ["p1"],
      finance_of: ["p1"],
      manager_of: ["p1"],
    },
  };

  /**
   * The access token lives in memory only (see lib/api/client.ts) — deliberately, so it never
   * lands in localStorage where any XSS can read it. The durable half of the session is the
   * httpOnly refresh_token cookie, which means every fresh page load has to trade that cookie
   * for a new access token before it can do anything. Nothing did that before, so a reload was
   * an unrecoverable logout even though the cookie was still perfectly valid.
   */
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRefreshTimer = () => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  };

  /** Access tokens live 900s. Rotate a minute early so an in-flight request never straddles
   *  the expiry; the floor keeps a surprisingly short expires_in from becoming a busy loop. */
  const scheduleRefresh = (expiresIn?: number) => {
    clearRefreshTimer();
    const seconds = typeof expiresIn === "number" && expiresIn > 0 ? expiresIn : 900;
    refreshTimer.current = setTimeout(
      () => { void rotateSession(); },
      Math.max(seconds - 60, 30) * 1000
    );
  };

  /** Pulls the access token out of a session envelope and arms the next rotation. */
  const applySession = (payload: unknown): boolean => {
    const body = payload as any;
    const session = body?.data ?? body;
    const accessToken = session?.access_token;
    if (!accessToken) return false;
    setAccessToken(accessToken);
    scheduleRefresh(session?.expires_in);
    return true;
  };

  /** Trades the refresh cookie for a new access token. A 401 just means "not signed in". */
  const rotateSession = async (): Promise<boolean> => {
    try {
      const { data, response } = await refreshSessionApi();
      if (!response.ok) return false;
      return applySession(data);
    } catch {
      return false;
    }
  };

  /** Signed out is not a failure. Anything else is, and must not look like being signed out. */
  const clearUser = () => {
    // Fallback to Mock Dev User ONLY in development mode so preview works without logging in.
    setUser(process.env.NODE_ENV === "development" ? MOCK_DEV_USER : null);
  };

  /**
   * Loads the current profile.
   *
   * The distinction that matters here is 401 vs everything else. This used to collapse every
   * unusable response — 500, network failure, malformed body — into setUser(null), which
   * renders identically to being signed out: a silent bounce to /login with no error and no
   * log. That is exactly how a server-side 500 on /auth/me masqueraded as "login doesn't
   * work" in production. A broken server must look broken.
   */
  const refreshUser = async () => {
    try {
      const { data, response } = await getMeApi();

      if (response.ok && data && (data as any).success && (data as any).data) {
        setAuthError(null);
        setUser((data as any).data as AuthUser);
        return;
      }
      if (response.ok && data && !("success" in (data as object)) && (data as any)._id) {
        setAuthError(null);
        setUser(data as AuthUser);
        return;
      }

      if (response.status === 401 || response.status === 403) {
        setAuthError(null);
        clearUser();
        return;
      }

      const message = response.ok
        ? "เซิร์ฟเวอร์ตอบกลับในรูปแบบที่ไม่รู้จัก กรุณาติดต่อฝ่าย IT"
        : `ระบบขัดข้องชั่วคราว (${response.status}) กรุณาลองใหม่อีกครั้ง หรือติดต่อฝ่าย IT`;
      console.error(`[auth] GET /auth/me failed with ${response.status}`, data);
      setAuthError({ kind: "server", status: response.status, message });
      clearUser();
    } catch (err) {
      console.error("[auth] GET /auth/me could not be reached", err);
      setAuthError({
        kind: "network",
        message: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต หรือติดต่อฝ่าย IT",
      });
      clearUser();
    } finally {
      setIsLoading(false);
    }
  };

  // Boot: redeem the refresh cookie first, then load the profile. rotateSession() is a no-op
  // when there's no cookie, so a genuinely signed-out visitor just falls through to a null user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await rotateSession();
      if (!cancelled) await refreshUser();
    })();
    return () => {
      cancelled = true;
      clearRefreshTimer();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { data, error, response } = await loginApi(email, password);

      if (error || !response.ok) {
        const errObj = error as any;
        const errorMessage =
          errObj?.error?.message ||
          (response.status === 401 ? "Incorrect email or password." : "Login failed. Please try again.");
        return { success: false, error: errorMessage };
      }

      applySession(data);

      await refreshUser();
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "An unexpected error occurred during login.",
      };
    }
  };

  /**
   * Google sign-in, second half. The Supabase token only proves identity — POST
   * /auth/login/supabase resolves it to a `staff` row and returns one of our sessions, or 404s
   * with ACCOUNT_NOT_CLAIMED (row exists, no password yet) / NOT_PROVISIONED (no row at all).
   * Both surface as `code` so the caller can route to the claim form rather than dead-end.
   */
  const loginWithSupabase = async (supabaseAccessToken: string): Promise<LoginResult> => {
    try {
      const { data, error, response } = await loginViaSupabaseApi(supabaseAccessToken);

      if (error || !response.ok) {
        const errObj = error as any;
        return {
          success: false,
          code: errObj?.error?.code,
          error:
            errObj?.error?.message ||
            (response.status === 401
              ? "เซสชัน Google หมดอายุ กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง"
              : "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาติดต่อฝ่าย IT"),
        };
      }

      applySession(data);

      await refreshUser();
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อระบบ กรุณาติดต่อฝ่าย IT",
      };
    }
  };

  /**
   * First login. POST /auth/claim doesn't just set the password — it returns a full session
   * (201), exactly like login does. That session used to be thrown away, so a user who had just
   * proved their identity through Google and chosen a password was dropped back onto a blank
   * login form to type that password in again. Now the claim signs them in directly.
   *
   * Error codes rather than statuses: NOT_PROVISIONED (no staff row) and ALREADY_CLAIMED
   * (password already set) both need distinct guidance, and the codes are stable where the
   * 404/409 pairing is incidental.
   */
  const claimAccount = async (
    password: string,
    supabaseAccessToken: string
  ): Promise<LoginResult> => {
    try {
      const { data, error, response } = await claimApi(password, supabaseAccessToken);

      if (error || !response.ok) {
        const errObj = error as any;
        return {
          success: false,
          code: errObj?.error?.code,
          error: errObj?.error?.message,
        };
      }

      applySession(data);
      await refreshUser();
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อระบบ กรุณาติดต่อฝ่าย IT",
      };
    }
  };

  const logout = async () => {
    clearRefreshTimer();
    // Clears the httpOnly cookie server-side. Without this the next page load would silently
    // sign the user straight back in off a cookie that outlived the "logout".
    try {
      await logoutApi();
    } catch {
      // Network failure shouldn't trap someone in a session they asked to leave — drop the
      // local half regardless.
    }
    setAccessToken(null);
    setUser(null);
    setAuthError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        authError,
        refreshUser,
        login,
        loginWithSupabase,
        claimAccount,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
