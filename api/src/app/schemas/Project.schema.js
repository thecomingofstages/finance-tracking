const { z } = require("zod");

const list = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const create = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  allocated_budget: z.number().int().nonnegative().optional(),
});

// Real enforcement of "total_income/total_expense are never client-writable" stays in
// Project.helper.js — kept out of .strict() here so that check's tailored error message
// (naming the exact field) is what the caller sees, not a generic zod "unrecognized key".
const update = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  allocated_budget: z.number().int().nonnegative().optional(),
  total_income: z.number().optional(),
  total_expense: z.number().optional(),
});

const tagItem = z.object({
  name: z.string().min(1),
  allocated_budget: z.number().int().nonnegative().optional(),
});
const createTags = z.object({ tags: z.array(tagItem).min(1) });
const updateTag = z.object({
  name: z.string().min(1).optional(),
  allocated_budget: z.number().int().nonnegative().optional(),
});

// #31/#32 — staff_dept membership. The flags are what make a department head a head, so they
// are explicit booleans rather than a role string: a person can be head AND finance.
const addStaff = z.object({
  staff_id: z.string().uuid(),
  department_id: z.string().uuid(),
  is_head: z.boolean().optional(),
  is_finance: z.boolean().optional(),
  is_manager: z.boolean().optional(),
});
const updateStaff = z.object({
  is_head: z.boolean().optional(),
  is_finance: z.boolean().optional(),
  is_manager: z.boolean().optional(),
});

const departmentItem = z.object({
  name: z.string().min(1),
  allocated_budget: z.number().int().nonnegative().optional(),
});
const createDepartments = z.object({ departments: z.array(departmentItem).min(1) });
const updateDepartment = z.object({
  name: z.string().min(1).optional(),
  allocated_budget: z.number().int().nonnegative().optional(),
});

module.exports = {
  list, create, update, createTags, updateTag, createDepartments, updateDepartment,
  addStaff, updateStaff,
};
