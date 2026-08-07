import { api } from "@/lib/api/client";

/**
 * Get report summary (GET /reports/summary)
 */
export async function getSummaryApi(project_id?: string) {
  return await api.GET("/reports/summary", {
    params: {
      query: { project_id },
    },
  });
}

/**
 * Get cashflow report (GET /reports/cashflow)
 */
export async function getCashflowApi() {
  return await api.GET("/reports/cashflow");
}

/**
 * Export journal report (POST /reports/journal/export)
 */
export async function exportJournalReportApi(body: {
  project_id?: string;
  start_date?: string;
  end_date?: string;
  month?: string;
}) {
  return await api.POST("/reports/journal/export", {
    body: body as any,
  });
}

