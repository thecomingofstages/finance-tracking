import { api } from "@/lib/api/client";

/**
 * Get reimbursements list (GET /reimbursements)
 */
export async function getReimbursementsApi(params?: {
  status?: string;
  limit?: number;
  page?: number;
  project_id?: string;
  department_id?: string;
}) {
  return await api.GET("/reimbursements", {
    params: {
      query: params as any,
    },
  });
}

/**
 * Create a new reimbursement request (POST /reimbursements)
 */
export async function createReimbursementApi(body: {
  department_id: string;
  tag_id?: string | null;
  purpose: string;
  banking_id?: string | null;
  details: { title: string; amount: number }[];
}) {
  return await api.POST("/reimbursements", {
    body: body as any,
  });
}

/**
 * Upload receipt image for reimbursement request (POST /reimbursements/{id}/receipt)
 */
export async function uploadReceiptApi(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("receipt", file);
  return await api.POST("/reimbursements/{id}/receipt", {
    params: {
      path: { id },
    },
    body: formData as any,
  });
}

/**
 * Get reimbursement details (GET /reimbursements/{id})
 */
export async function getReimbursementDetailApi(id: string) {
  return await api.GET("/reimbursements/{id}", {
    params: {
      path: { id },
    },
  });
}

/**
 * Update reimbursement status (POST /reimbursements/{id}/status)
 *
 * The endpoint accepts exactly `status`, `tracking_id` and `reason` — there is no `note`
 * field and never was. This used to send `note`, which the API silently dropped, and packed
 * the tracking id inside it as `[Tracking: X] ...` when both were filled. The visible effect
 * was that finance approval could not succeed at all: `head_approve -> fin_approve` requires
 * `tracking_id`, which never arrived, so every attempt came back 400.
 *
 * Which field is required depends on the transition (Approval.helper.js TRANSITIONS):
 *   head_approve -> fin_approve   requires tracking_id
 *   any          -> rejected      requires reason
 *   everything else               neither
 */
export async function updateReimbursementStatusApi(
  id: string,
  status: string,
  fields?: { tracking_id?: string; reason?: string },
  reauthToken?: string
) {
  return await api.POST("/reimbursements/{id}/status", {
    params: {
      path: { id },
    },
    body: {
      status: status as any,
      ...(fields?.tracking_id ? { tracking_id: fields.tracking_id } : {}),
      ...(fields?.reason ? { reason: fields.reason } : {}),
    } as any,
    headers: reauthToken ? { "X-Reauth-Token": reauthToken } : undefined,
  });
}

/**
 * Update reimbursement details (PATCH /reimbursements/{id})
 */
export async function updateReimbursementDetailApi(
  id: string,
  body: { purpose?: string; details?: any[] }
) {
  return await api.PATCH("/reimbursements/{id}", {
    params: { path: { id } },
    body: body as any,
  });
}

/**
 * Get the document URL for printing (GET /reimbursements/{id}/document)
 * Note: This returns a URL string that can be used in an iframe or window.open
 */
export function getReimbursementDocumentUrl(id: string, type: "request" | "voucher", format: "pdf" | "html" = "pdf") {
  // Assuming BASE_URL from client or just relative path if proxied
  return `/api/v1/reimbursements/${id}/document?type=${type}&format=${format}`;
}

