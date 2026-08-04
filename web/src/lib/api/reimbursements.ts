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
 */
export async function updateReimbursementStatusApi(
  id: string,
  status: string,
  note?: string,
  reauthToken?: string
) {
  return await api.POST("/reimbursements/{id}/status", {
    params: {
      path: { id },
    },
    body: {
      status: status as any,
      note,
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

