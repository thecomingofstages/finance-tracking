"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getMeApi, loginApi } from "../lib/api/auth";
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

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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

  const refreshUser = async () => {
    try {
      const { data, error } = await getMeApi();
      if (data && data.success && data.data) {
        setUser(data.data as AuthUser);
      } else if (data && !("success" in data) && (data as any)._id) {
        setUser(data as AuthUser);
      } else {
        // Fallback to Mock Dev User ONLY in development mode so preview works without logging in
        if (process.env.NODE_ENV === "development") {
          setUser(MOCK_DEV_USER);
        } else {
          setUser(null);
        }
      }
    } catch {
      if (process.env.NODE_ENV === "development") {
        setUser(MOCK_DEV_USER);
      } else {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
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

      const resData = data as any;
      const accessToken = resData?.data?.access_token || resData?.access_token;

      if (accessToken) {
        setAccessToken(accessToken);
      }

      await refreshUser();
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "An unexpected error occurred during login.",
      };
    }
  };

  const logout = async () => {
    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, refreshUser, login, logout }}>
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
