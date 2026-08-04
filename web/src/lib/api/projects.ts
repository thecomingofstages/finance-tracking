import { api } from "@/lib/api/client";

// ──────────────────────────── Projects ────────────────────────────

/** List projects (GET /projects) */
export async function getProjectsApi() {
  return await api.GET("/projects");
}

/** Create project (POST /projects) */
export async function createProjectApi(body: {
  name: string;
  code?: string;
  description?: string;
  allocated_budget?: number;
}) {
  return await api.POST("/projects", { body: body as any });
}

/** Get project detail (GET /projects/{id}) */
export async function getProjectDetailApi(id: string) {
  return await api.GET("/projects/{id}", { params: { path: { id } } });
}

/** Update project (PATCH /projects/{id}) */
export async function updateProjectApi(id: string, body: Record<string, any>) {
  return await api.PATCH("/projects/{id}", { params: { path: { id } }, body: body as any });
}

// ──────────────────────────── Tags ────────────────────────────

/** List tags (GET /projects/{id}/tags) */
export async function getProjectTagsApi(id: string) {
  return await api.GET("/projects/{id}/tags", { params: { path: { id } } });
}

/** Bulk create tags (POST /projects/{id}/tags) */
export async function createProjectTagsApi(
  projectId: string,
  tags: { name: string; allocated_budget?: number }[]
) {
  return await api.POST("/projects/{id}/tags", {
    params: { path: { id: projectId } },
    body: { tags } as any,
  });
}

/** Update tag (PATCH /tags/{id}) */
export async function updateTagApi(id: string, body: { name?: string; allocated_budget?: number }) {
  return await api.PATCH("/tags/{id}", { params: { path: { id } }, body: body as any });
}

/** Delete tag (DELETE /tags/{id}) */
export async function deleteTagApi(id: string) {
  return await api.DELETE("/tags/{id}", { params: { path: { id } } });
}

// ──────────────────────────── Departments ────────────────────────────

/** List departments (GET /projects/{id}/departments) */
export async function getProjectDepartmentsApi(id: string) {
  return await api.GET("/projects/{id}/departments", { params: { path: { id } } });
}

/** Bulk create departments (POST /projects/{id}/departments) */
export async function createProjectDepartmentsApi(
  projectId: string,
  departments: { name: string; allocated_budget?: number }[]
) {
  return await api.POST("/projects/{id}/departments", {
    params: { path: { id: projectId } },
    body: { departments } as any,
  });
}

/** Update department (PATCH /departments/{id}) */
export async function updateDepartmentApi(id: string, body: { name?: string; allocated_budget?: number }) {
  return await api.PATCH("/departments/{id}", { params: { path: { id } }, body: body as any });
}

/** Delete department (DELETE /departments/{id}) */
export async function deleteDepartmentApi(id: string) {
  return await api.DELETE("/departments/{id}", { params: { path: { id } } });
}

// ──────────────────────────── Sources ────────────────────────────

/** List funding sources (GET /projects/{id}/sources) */
export async function getProjectSourcesApi(id: string) {
  return await api.GET("/projects/{id}/sources", { params: { path: { id } } });
}

/** Create funding source (POST /projects/{id}/sources) */
export async function createProjectSourceApi(
  projectId: string,
  body: {
    type: "enroll" | "merch" | "spon" | "other";
    name: string;
    tag_id?: string | null;
    expect_amount?: number;
    reference_id?: string | null;
  }
) {
  return await api.POST("/projects/{id}/sources", {
    params: { path: { id: projectId } },
    body: body as any,
  });
}

/** Update source (PATCH /sources/{id}) */
export async function updateSourceApi(id: string, body: { name?: string; tag_id?: string | null; expect_amount?: number }) {
  return await api.PATCH("/sources/{id}", { params: { path: { id } }, body: body as any });
}

/** Delete source (DELETE /sources/{id}) */
export async function deleteSourceApi(id: string) {
  return await api.DELETE("/sources/{id}", { params: { path: { id } } });
}
