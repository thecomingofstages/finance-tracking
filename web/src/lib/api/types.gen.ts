export interface paths {
    "/auth/claim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** First login — set password (#57) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        password: string;
                    };
                };
            };
            responses: {
                /** @description Session issued */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
                409: components["responses"]["Conflict"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Email + password login (#1) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** Format: email */
                        email: string;
                        password: string;
                    };
                };
            };
            responses: {
                /** @description Session issued */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
                /** @description Rate limited */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login/supabase": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Login via Supabase Auth session (#58) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Session issued */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Terminate session (#2) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rotate access token via refresh cookie (#3) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description New access token */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/password/forgot": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Request password reset (#5) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Always 200 regardless of whether the email exists */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/password/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Complete password reset (#6) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        reset_token: string;
                        password: string;
                    };
                };
            };
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/verify-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Step-up — issue X-Reauth-Token (#59) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        password: string;
                    };
                };
            };
            responses: {
                /** @description reauth_token issued */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Current staff + resolved scope (#4) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Envelope"] & {
                            data?: components["schemas"]["Staff"] & {
                                scope?: components["schemas"]["Scope"];
                            };
                        };
                    };
                };
                401: components["responses"]["Unauthorized"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/staff": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List staff (#7) — manager only */
        get: {
            parameters: {
                query?: {
                    page?: components["parameters"]["pageParam"];
                    limit?: components["parameters"]["limitParam"];
                    department_id?: string;
                    project_id?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                403: components["responses"]["Forbidden"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/staff/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get one staff member (#8) — manager only */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                403: components["responses"]["Forbidden"];
                404: components["responses"]["NotFound"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/staff/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update own profile (#9) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        nickname?: string;
                        phone?: string;
                        line_id?: string;
                        title?: components["schemas"]["Title"];
                    };
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["ValidationError"];
            };
        };
        trace?: never;
    };
    "/staff/me/bank-accounts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List own bank accounts (#14) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /** Add bank account — immutable after creation (#15) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        name: string;
                        number: string;
                        provider: string;
                    };
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["ValidationError"];
                409: components["responses"]["Conflict"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/staff/me/bank-accounts/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Remove bank account (#16) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                403: components["responses"]["Forbidden"];
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/staff/me/signature": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Upload digital signature — step-up required (#60) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "multipart/form-data": {
                        /** Format: binary */
                        signature?: string;
                    };
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description REAUTH_REQUIRED */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/staff": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Provision a staff account (#10) — admin only */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        title?: components["schemas"]["Title"];
                        first_name: string;
                        last_name: string;
                        nickname: string;
                        /** Format: email */
                        email: string;
                        phone?: string;
                    };
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                409: components["responses"]["Conflict"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/staff/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Bulk provision from CSV (#11) — admin only
         * @description Required columns: first_name, last_name, nickname, email. Optional: title, phone, line_id, department_id (a real department._id UUID, not a name — leave blank/omit for no department, that's not an error). All-or-nothing: every row is validated — required fields, email format, duplicate email within the file, duplicate against live staff, unknown department_id — before anything is written; any failure returns the full per-row error list in error.details and inserts nothing. staff_dept was originally scoped as manual-only (docs/backend/03-api-spec.md §5); department_id added 2026-07-27 on request.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "multipart/form-data": {
                        /** Format: binary */
                        file?: string;
                    };
                };
            };
            responses: {
                /** @description All-or-nothing; per-row errors on failure */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["ValidationError"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/staff/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Deactivate staff — soft delete only (#13) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        /** Admin update staff, incl. email/role (#12) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                409: components["responses"]["Conflict"];
            };
        };
        trace?: never;
    };
    "/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List projects (#17) */
        get: {
            parameters: {
                query?: {
                    page?: components["parameters"]["pageParam"];
                    limit?: components["parameters"]["limitParam"];
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /** Create project — finance/admin only (#18) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        name: string;
                        description?: string;
                        allocated_budget?: number;
                    };
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Project detail (#19) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
            };
        };
        put?: never;
        post?: never;
        /**
         * Delete project — admin only (#21)
         * @description 409 PROJECT_HAS_DEPENDENTS if any live tag, department, source, or reimbursement (checked transitively via department) still references it.
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
                409: components["responses"]["Conflict"];
            };
        };
        options?: never;
        head?: never;
        /**
         * Update project (#20)
         * @description total_income/total_expense are never client-writable — 400 if present in the body.
         */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["ValidationError"];
                404: components["responses"]["NotFound"];
            };
        };
        trace?: never;
    };
    "/projects/{id}/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List tags (#22) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /** Bulk create tags (#23) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        tags: {
                            name: string;
                            allocated_budget?: number;
                        }[];
                    };
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                409: components["responses"]["Conflict"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tags/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete tag (#25)
         * @description 409 TAG_HAS_DEPENDENTS if any live source or reimbursement still references it.
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
                409: components["responses"]["Conflict"];
            };
        };
        options?: never;
        head?: never;
        /**
         * Update tag (#24)
         * @description 409 DUPLICATE_TAG on a rename colliding with another tag in the same project (application-level rule, no DB UNIQUE on name).
         */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
                409: components["responses"]["Conflict"];
            };
        };
        trace?: never;
    };
    "/projects/{id}/departments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List departments (#26) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /** Bulk create departments (#27) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        departments: {
                            name: string;
                            allocated_budget?: number;
                        }[];
                    };
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/departments/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete department (#29)
         * @description 409 DEPARTMENT_HAS_DEPENDENTS if it still has members (live staff_dept) or live reimbursements (checked transitively via staff_dept, so this still blocks even after every member has left).
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
                409: components["responses"]["Conflict"];
            };
        };
        options?: never;
        head?: never;
        /**
         * Update department (#28)
         * @description 409 DUPLICATE_DEPARTMENT on a rename colliding with another department in the same project.
         */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
                409: components["responses"]["Conflict"];
            };
        };
        trace?: never;
    };
    "/projects/{id}/staff": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List project staff — manager only (#30) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                403: components["responses"]["Forbidden"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{id}/sources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List funding sources (#33) — finance only */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /**
         * Create a funding source (#34)
         * @description `reference_id` is required for type enroll/merch, and must be omitted for spon/other. `actual_amount` mirrors `expect_amount` immediately for spon/other (no approval step); stays 0 for enroll/merch until payments are approved. `tag_id`, if given, must belong to the same project — 400 otherwise.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        type: components["schemas"]["SourceType"];
                        name: string;
                        /** Format: uuid */
                        tag_id?: string | null;
                        expect_amount?: number;
                        /** Format: uuid */
                        reference_id?: string | null;
                    };
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["ValidationError"];
                404: components["responses"]["NotFound"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sources/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete source (#36)
         * @description 409 SOURCE_HAS_DEPENDENTS if any live payment still references it.
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
                409: components["responses"]["Conflict"];
            };
        };
        options?: never;
        head?: never;
        /** Update source — never actual_amount/type/reference_id/project_id (#35) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["ValidationError"];
                404: components["responses"]["NotFound"];
            };
        };
        trace?: never;
    };
    "/payments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Checkslip queue (#38) — finance only */
        get: {
            parameters: {
                query: {
                    project_id: string;
                    status?: components["schemas"]["PaymentStatusValue"];
                    page?: components["parameters"]["pageParam"];
                    limit?: components["parameters"]["limitParam"];
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Sorted oldest-first */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /** Ingest a payment from Enroll/Merch — service token only, idempotent (#37) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /**
                         * Format: uuid
                         * @description registration_id | purchase_id
                         */
                        _id: string;
                        /** Format: uuid */
                        user_id?: string;
                        /** Format: uuid */
                        source_id: string;
                        expected_amount?: number;
                        promptpay_qr_data?: string;
                    };
                };
            };
            responses: {
                /** @description Created (or 200 if already ingested — idempotent on _id) */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                401: components["responses"]["Unauthorized"];
                /** @description SOURCE_NOT_FOUND — no source configured for this activity/store yet */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description DUPLICATE_QR_DATA — this promptpay_qr_data is already attached to a different payment */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Payment detail + full history (#39) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Bulk approve/reject — step-up required, idempotent per item (#40) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        decisions: {
                            /** Format: uuid */
                            payment_id: string;
                            /** @enum {string} */
                            status: "approved" | "rejected";
                            actual_amount?: number;
                        }[];
                    };
                };
            };
            responses: {
                /** @description Partial-success by design — each item is approved/rejected/skipped independently, in its own transaction. amount_matches compares actual_amount to the payment's own expected_amount (accept-and-flag on a mismatch, not a hard reject — doc 03 §8 open question #9). Skip reasons: already decided by someone else, payment not found, or caller isn't finance for that payment's project (checked per item, not batch-wide). */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description REAUTH_REQUIRED — missing/expired X-Reauth-Token */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reimbursements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List — scoped to what the caller requested or can approve (#42) */
        get: {
            parameters: {
                query?: {
                    status?: components["schemas"]["ReimbursementStatusValue"];
                    department_id?: string;
                    project_id?: string;
                    mine?: boolean;
                    page?: components["parameters"]["pageParam"];
                    limit?: components["parameters"]["limitParam"];
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /** Create — lands directly in 'waiting', no draft stage (#41) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** Format: uuid */
                        department_id: string;
                        /** Format: uuid */
                        tag_id?: string | null;
                        purpose: string;
                        /** Format: uuid */
                        banking_id?: string | null;
                        details: {
                            title: string;
                            amount: number;
                        }[];
                    };
                };
            };
            responses: {
                /** @description Created. meta.budget is a real computed projection (sum of every non-rejected/ non-deleted reimbursement in the department vs. its allocated_budget) — warns, never blocks. Lands in 'head_approve' immediately, not 'waiting', if the requester themselves heads the target department (doc 04 §4 auto-verify). */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["ValidationError"];
                /** @description Not a member of department_id, or banking_id isn't a live account the caller owns */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
                /** @description TAG_PROJECT_MISMATCH — tag_id doesn't belong to department_id's project */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reimbursements/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Bulk import from Google Form CSV — is_finance on project_id, lands in 'waiting' (#49)
         * @description Fixed columns (not the doc's aspirational per-project-configurable mapping, which doesn't exist yet): requester_email, department, purpose, title, amount, and optional tag — one detail line per row. All-or-nothing: every row is resolved (requester by email, department/tag by name scoped to project_id) and validated before anything is written; any row failing returns the full per-row list in error.details and inserts nothing. Auto-verifies to head_approve per-row if that row's requester heads the resolved department (same rule as POST /reimbursements).
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "multipart/form-data": {
                        /**
                         * Format: uuid
                         * @description form field, not JSON — multer only extracts `file`
                         */
                        project_id: string;
                        /** Format: binary */
                        file: string;
                    };
                };
            };
            responses: {
                /** @description { created, reimbursement_ids } */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["responses"]["ValidationError"];
                /** @description Caller isn't finance for project_id */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reimbursements/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Detail — requester, approver, finance, or owner (#43) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                403: components["responses"]["Forbidden"];
            };
        };
        put?: never;
        post?: never;
        /** Cancel — valid from waiting or rejected (#45) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                422: components["responses"]["Unprocessable"];
            };
        };
        options?: never;
        head?: never;
        /** Edit — only while waiting or rejected (#44) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                422: components["responses"]["Unprocessable"];
            };
        };
        trace?: never;
    };
    "/reimbursements/{id}/receipt": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Upload receipt (#46) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "multipart/form-data": {
                        /** Format: binary */
                        receipt?: string;
                    };
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reimbursements/{id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Advance the approval chain — step-up required on every call (#47) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        status: components["schemas"]["ReimbursementStatusValue"];
                        /** @description required for head_approve -> fin_approve */
                        tracking_id?: string;
                        /** @description required for any -> rejected */
                        reason?: string;
                    };
                };
            };
            responses: {
                /** @description OK — updated reimbursement + full history. The caller must hold the flag the transition demands (isHead/isFinance/isOwner/isRequester), checked for real via a direct StaffDept query, not the mock-permissive req.scope. fin_approve->transfer (owner only) explicitly rolls the total up to department/project/tag — no trigger does this yet (doc 02 §6 gap #1). */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Missing tracking_id (head_approve->fin_approve) or reason (any ->rejected) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description REAUTH_REQUIRED */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Caller doesn't hold the required flag for this transition */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: components["responses"]["NotFound"];
                /** @description INVALID_TRANSITION — see docs/backend/04-authorization.md §4 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reimbursements/{id}/document": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Render ใบเบิกเงิน / ใบสำคัญจ่าย (#48)
         * @description Authorization (requester/head/finance/owner), NOT_APPROVED check, bank-account masking, Thai baht text, and verification QR are all real. Both type=request and type=voucher render real templates (real Puppeteer, both format=html and format=pdf) from real company documents — see templates/reimbursement-request.html and templates/reimbursement-voucher.html. Note: the voucher's หัก ณ ที่จ่าย (withholding tax) always shows 0 — nothing in this schema models a tax rate yet, so it's a real gap, not a computed (possibly wrong) value. Bank account number is masked (xxxxxx1234) unless the viewer is the requester, is_finance on the project, or owner/admin.
         */
        get: {
            parameters: {
                query: {
                    type: "request" | "voucher";
                    format?: "pdf" | "html";
                };
                header?: never;
                path: {
                    id: components["parameters"]["idParam"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description PDF or HTML document */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/pdf": string;
                        "text/html": string;
                    };
                };
                /** @description type must be 'request' or 'voucher' */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                403: components["responses"]["Forbidden"];
                404: components["responses"]["NotFound"];
                /** @description NOT_APPROVED — voucher requires fin_approve or transfer */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reports/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Dashboard totals (#50) */
        get: {
            parameters: {
                query?: {
                    project_id?: string;
                    tag_id?: string;
                    department_id?: string;
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reports/cashflow": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** / page breakdown — finance/owner only (#51) */
        get: {
            parameters: {
                query?: {
                    project_id?: string;
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reports/journal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** สมุดรายวัน — finance/owner only (#52) */
        get: {
            parameters: {
                query?: {
                    project_id?: string;
                    month?: string;
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reports/journal/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Download journal as a file — finance/owner only (#53) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        format?: "xlsx" | "pdf";
                    };
                };
            };
            responses: {
                /** @description File download. Mock returns CSV for xlsx (real XLSX not wired up yet). */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/pdf": string;
                        "text/csv": string;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reports/ledger": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * บัญชีแยกประเภท — BLOCKED (#54)
         * @description Not reachable from the current schema — no chart of accounts. See docs/backend/05-open-questions.md #1. Returns 501 until that's decided.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Not implemented — blocked pending a schema decision */
                501: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reports/top-expenses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Top-K most expensive line items (#55) */
        get: {
            parameters: {
                query?: {
                    project_id?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reports/sponsors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Sponsor details per project — finance/owner only (#56) */
        get: {
            parameters: {
                query?: {
                    project_id?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Envelope: {
            success: boolean;
        };
        ErrorResponse: components["schemas"]["Envelope"] & {
            /** @constant */
            success?: false;
            error: {
                /** @example VALIDATION_ERROR */
                code: string;
                message: string;
                field?: string;
            };
        };
        Meta: {
            page?: number;
            limit?: number;
            total?: number;
        };
        /**
         * @description No DRAFT — a reimbursement is created directly into 'waiting'.
         * @enum {string}
         */
        ReimbursementStatusValue: "waiting" | "head_approve" | "fin_approve" | "transfer" | "rejected" | "delete";
        /** @enum {string} */
        PaymentStatusValue: "waiting" | "approved" | "rejected";
        /** @enum {string} */
        SourceType: "enroll" | "merch" | "spon" | "other";
        /** @enum {string} */
        Role: "user" | "staff" | "finance" | "it" | "hr" | "owner" | "admin";
        /** @enum {string} */
        Title: "เด็กชาย" | "เด็กหญิง" | "นาย" | "นาง" | "นางสาว";
        Staff: {
            /** Format: uuid */
            _id?: string;
            title?: components["schemas"]["Title"];
            first_name?: string;
            last_name?: string;
            nickname?: string;
            /** Format: email */
            email?: string;
            phone?: string;
            line_id?: string;
            role?: components["schemas"]["Role"];
            signature_image?: string | null;
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            updated_at?: string;
        };
        Scope: {
            memberships?: {
                /** Format: uuid */
                project_id?: string;
                project_name?: string;
                /** Format: uuid */
                department_id?: string;
                department_name?: string;
                is_head?: boolean;
                is_finance?: boolean;
                is_manager?: boolean;
            }[];
            head_of?: string[];
            finance_of?: string[];
            manager_of?: string[];
        };
        BankAccount: {
            /** Format: uuid */
            _id?: string;
            name?: string;
            /** @description Masked (xxxxxx7890) unless viewed by the owner */
            number?: string;
            provider?: string;
            /** Format: date-time */
            created_at?: string;
        };
        Project: {
            /** Format: uuid */
            _id?: string;
            name?: string;
            description?: string | null;
            /** @description satang */
            allocated_budget?: number;
            /** @description satang — no trigger updates this yet, see doc 02 §6 */
            total_income?: number;
            /** @description satang — no trigger updates this yet */
            total_expense?: number;
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            updated_at?: string;
        };
        ProjectTag: {
            /** Format: uuid */
            _id?: string;
            /** Format: uuid */
            project_id?: string;
            name?: string;
            allocated_budget?: number;
            total_income?: number;
            total_expense?: number;
        };
        Department: {
            /** Format: uuid */
            _id?: string;
            /** Format: uuid */
            project_id?: string;
            name?: string;
            allocated_budget?: number;
            total_expense?: number;
        };
        Source: {
            /** Format: uuid */
            _id?: string;
            type?: components["schemas"]["SourceType"];
            /** Format: uuid */
            reference_id?: string | null;
            /**
             * Format: uuid
             * @description optional
             */
            tag_id?: string | null;
            /** Format: uuid */
            project_id?: string;
            /** @description satang — note: expect_, not expected_ */
            expect_amount?: number;
            /** @description satang — no trigger updates this yet */
            actual_amount?: number;
            name?: string;
        };
        Payment: {
            /**
             * Format: uuid
             * @description external registration_id | purchase_id
             */
            _id?: string;
            /** Format: uuid */
            user_id?: string | null;
            /** Format: uuid */
            source_id?: string;
            expected_amount?: number;
            promptpay_qr_data?: string | null;
            /** Format: date-time */
            created_at?: string;
        };
        PaymentStatusEntry: {
            status?: components["schemas"]["PaymentStatusValue"];
            actual_amount?: number | null;
            staff?: {
                nickname?: string;
            } | null;
            /** Format: date-time */
            created_at?: string;
        };
        ReimbursementDetail: {
            /** Format: uuid */
            _id?: string;
            title?: string;
            amount?: number;
        };
        Reimbursement: {
            /** Format: uuid */
            _id?: string;
            /** Format: uuid */
            staff_dept_id?: string;
            /** Format: uuid */
            tag_id?: string | null;
            purpose?: string;
            tracking_id?: string | null;
            /** Format: uuid */
            banking_id?: string | null;
            /** @description presigned R2 URL, not a raw object key */
            receipt_link?: string | null;
            latest_status?: components["schemas"]["ReimbursementStatusValue"];
            details?: components["schemas"]["ReimbursementDetail"][];
            /** Format: date-time */
            created_at?: string;
        };
        ReimbursementStatusEntry: {
            status?: components["schemas"]["ReimbursementStatusValue"];
            staff?: {
                nickname?: string;
            } | null;
            /** Format: date-time */
            created_at?: string;
        };
    };
    responses: {
        /** @description Missing/invalid/expired token */
        Unauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Insufficient scope */
        Forbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Resource not found */
        NotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Bad request */
        ValidationError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Duplicate / conflict */
        Conflict: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Business-rule rejection */
        Unprocessable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
    };
    parameters: {
        idParam: string;
        pageParam: number;
        limitParam: number;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
