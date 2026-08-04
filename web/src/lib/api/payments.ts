import { api } from "@/lib/api/client";

/**
 * Get payments list (GET /payments)
 */
export async function getPaymentsApi(params?: {
  status?: string;
  limit?: number;
  page?: number;
}) {
  return await api.GET("/payments", {
    params: {
      query: params as any,
    },
  });
}

/**
 * Bulk approve/reject payment requests (POST /payments/approve)
 */
export async function bulkApprovePaymentsApi(
  decisions: {
    payment_id: string;
    status: "approved" | "rejected";
    actual_amount?: number;
  }[],
  reauthToken: string
) {
  return await api.POST("/payments/approve", {
    body: { decisions } as any,
    headers: { "X-Reauth-Token": reauthToken },
  });
}
