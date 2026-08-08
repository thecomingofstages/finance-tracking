import { api } from "./client";

/**
 * Login with email and password (POST /auth/login)
 */
export async function loginApi(email: string, password: string) {
  return await api.POST("/auth/login", {
    body: { email, password },
  });
}

/**
 * First login / claim account (POST /auth/claim) with Supabase session token in Authorization header
 */
export async function claimApi(password: string, sessionToken: string) {
  return await api.POST("/auth/claim", {
    body: { password },
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });
}

/**
 * Login via an existing Supabase Auth session (POST /auth/login/supabase) — the Google sign-in
 * path. Sends the *Supabase* access token as Bearer, not one of our own; the API verifies it
 * against GoTrue and issues one of our sessions in exchange. 404 ACCOUNT_NOT_CLAIMED means the
 * staff row exists but has no password yet — send the user through claimApi with the same token.
 */
export async function loginViaSupabaseApi(supabaseAccessToken: string) {
  return await api.POST("/auth/login/supabase", {
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
    },
  });
}

/**
 * Rotate the access token using the httpOnly refresh_token cookie (POST /auth/refresh).
 * Sends no Bearer header by design — the cookie is the whole credential. A 401 here is the
 * normal "not signed in" answer, not an error worth surfacing.
 */
export async function refreshSessionApi() {
  return await api.POST("/auth/refresh");
}

/** Clear the refresh cookie server-side (POST /auth/logout). */
export async function logoutApi() {
  return await api.POST("/auth/logout");
}

/**
 * Get current staff profile & scope (GET /auth/me)
 */
export async function getMeApi() {
  return await api.GET("/auth/me");
}

/**
 * Verify password for step-up re-authentication (POST /auth/verify-password).
 * Returns response object along with convenience reauth_token property.
 */
export async function verifyPasswordApi(password: string) {
  const result = await api.POST("/auth/verify-password", {
    body: { password },
  });
  const resData = result.data as any;
  const reauth_token: string | undefined = resData?.data?.reauth_token || resData?.reauth_token;
  return {
    ...result,
    reauth_token,
  };
}

/**
 * Request password reset email (POST /auth/password/forgot)
 */
export async function forgotPasswordApi(email: string) {
  return await api.POST("/auth/password/forgot", {
    body: { email } as any,
  });
}

/**
 * Complete password reset using reset token (POST /auth/password/reset)
 */
export async function resetPasswordApi(reset_token: string, password: string) {
  return await api.POST("/auth/password/reset", {
    body: { reset_token, password },
  });
}

/**
 * Upload digital signature image with step-up header (POST /staff/me/signature)
 */
export async function uploadSignatureApi(file: File, reauthToken: string) {
  const formData = new FormData();
  formData.append("signature", file);
  return await api.POST("/staff/me/signature", {
    body: formData as any,
    headers: {
      "X-Reauth-Token": reauthToken,
    },
  });
}
