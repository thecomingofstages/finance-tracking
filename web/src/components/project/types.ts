export interface ProjectSource {
  _id?: string;
  id?: string;
  type: string;
  name: string;
  expect_amount?: number;
  actual_amount?: number;
  reference_id?: string;
  tag_id?: string;
}

export interface ProjectTag {
  _id?: string;
  id?: string;
  name: string;
  allocated_budget?: number;
  total_income?: number;
  total_expense?: number;
}

export interface ProjectDepartment {
  _id?: string;
  id?: string;
  name: string;
  allocated_budget?: number;
  total_expense?: number;
  actual_expense?: number;
}

export interface ReimbursementItem {
  _id?: string;
  id?: string;
  title?: string;
  purpose?: string;
  tag_name?: string;
  tag_id?: string;
  tag?: any;
  department_name?: string;
  department_id?: string;
  department?: any;
  amount?: number;
  status?: string;
  latest_status?: string;
  created_at?: string;
  createdAt?: string;
  tracking_id?: string;
  requester_name?: string;
  staff_name?: string;
  staff?: any;
}
