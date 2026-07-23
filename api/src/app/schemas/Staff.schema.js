const { z } = require("zod");

// Shape/type validation only — the "email and role aren't editable via PATCH /staff/me"
// business rule stays in Staff.helper.js's own whitelist check (doc 03 §5), not duplicated
// here with a second, differently-worded error.

const updateSelf = z.object({
  nickname: z.string().min(1).optional(),
  phone: z.string().regex(/^[0-9]{9,10}$/).optional(),
  line_id: z.string().optional(),
  title: z.enum(["เด็กชาย", "เด็กหญิง", "นาย", "นาง", "นางสาว"]).optional(),
});

const addBankAccount = z.object({
  name: z.string().min(1),
  number: z.string().regex(/^[0-9]{10,12}$/),
  provider: z.string().min(1),
});

const adminCreate = z.object({
  title: z.enum(["เด็กชาย", "เด็กหญิง", "นาย", "นาง", "นางสาว"]).optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  nickname: z.string().min(1),
  email: z.string().email(),
  phone: z.string().regex(/^[0-9]{9,10}$/).optional(),
});

const adminUpdate = z.object({
  title: z.enum(["เด็กชาย", "เด็กหญิง", "นาย", "นาง", "นางสาว"]).optional(),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  nickname: z.string().min(1).optional(),
  phone: z.string().regex(/^[0-9]{9,10}$/).optional(),
  line_id: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(["user", "staff", "finance", "it", "hr", "owner", "admin"]).optional(),
});

module.exports = { updateSelf, addBankAccount, adminCreate, adminUpdate };
