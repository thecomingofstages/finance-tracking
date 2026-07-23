const { z } = require("zod");

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

const departmentItem = z.object({
  name: z.string().min(1),
  allocated_budget: z.number().int().nonnegative().optional(),
});
const createDepartments = z.object({ departments: z.array(departmentItem).min(1) });
const updateDepartment = z.object({
  name: z.string().min(1).optional(),
  allocated_budget: z.number().int().nonnegative().optional(),
});

module.exports = { create, update, createTags, updateTag, createDepartments, updateDepartment };
