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
