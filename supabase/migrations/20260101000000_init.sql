create extension if not exists "uuid-ossp";

create or replace function uuid_generate_v7()
returns uuid
as $$
begin
  return encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid()) placing
          substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
          from 1 for 6),
        52, 1),
      53, 1),
    'hex')::uuid;
end;
$$ language plpgsql volatile;

-- Enum --

-- Enum for staff table
CREATE TYPE titles AS ENUM(
  'เด็กชาย', 
  'เด็กหญิง', 
  'นาย', 
  'นาง', 
  'นางสาว'
);

CREATE TYPE roles AS ENUM (
  'user', 
  'staff', 
  'finance', 
  'it', 
  'hr', 
  'owner', 
  'admin'
);

-- Enum for Source Types
CREATE TYPE source_types AS ENUM(
  'enroll', 
  'merch', 
  'spon', 
  'other'
);

-- Status for payment verification
CREATE TYPE payment_available_status AS ENUM(
  'waiting',
  'approved',
  'rejected'
);

-- Status for reimbursement verification
CREATE TYPE reimbursement_available_status AS ENUM(
  'waiting',
  'rejected',
  'delete',
  'head_approve',
  'fin_approve',
  'transfer'
);

-- Table --

CREATE TABLE project (
  _id UUID DEFAULT uuid_generate_v7() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  allocated_budget INTEGER DEFAULT 0,
  total_income INTEGER DEFAULT 0,
  total_expense INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL, 
  CHECK (allocated_budget >= 0 AND total_income >= 0 AND total_expense >= 0)
);

CREATE TABLE project_tag (
  _id UUID DEFAULT uuid_generate_v7() PRIMARY KEY,
  project_id UUID REFERENCES project (_id),
  name TEXT,
  allocated_budget INTEGER DEFAULT 0,
  total_income INTEGER DEFAULT 0,
  total_expense INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  CHECK (allocated_budget >= 0 AND total_income >= 0 AND total_expense >= 0)
);

CREATE TABLE department (
  _id UUID DEFAULT uuid_generate_v7() PRIMARY KEY,
  project_id UUID REFERENCES project (_id),
  name TEXT,
  allocated_budget INTEGER DEFAULT 0,
  total_expense INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  CHECK (allocated_budget >= 0 AND total_expense >= 0)
);

CREATE TABLE staff (
  _id UUID DEFAULT uuid_generate_v7() PRIMARY KEY,
  title titles DEFAULT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  nickname TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT DEFAULT NULL,
  phone VARCHAR(10) DEFAULT NULL,
  line_id TEXT DEFAULT NULL,
  role roles DEFAULT 'staff',
  signature_image TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE bankaccount (
  _id UUID DEFAULT uuid_generate_v7() PRIMARY KEY,
  name TEXT NOT NULL,
  number VARCHAR(12) UNIQUE NOT NULL,
  provider TEXT NOT NULL,
  staff_id UUID NOT NULL REFERENCES staff (_id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE staff_dept (
  _id UUID DEFAULT uuid_generate_v7() PRIMARY KEY,
  staff_id UUID REFERENCES staff (_id),
  department_id UUID REFERENCES department (_id),
  is_head BOOLEAN DEFAULT FALSE,
  is_finance BOOLEAN DEFAULT FALSE,
  is_manager BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE source (
  _id UUID DEFAULT uuid_generate_v7() PRIMARY KEY,
  type source_types NOT NULL,
  reference_id UUID DEFAULT NULL,
  tag_id UUID DEFAULT NULL REFERENCES project_tag (_id),
  project_id UUID NOT NULL REFERENCES project (_id),
  expect_amount INTEGER DEFAULT 0,
  actual_amount INTEGER DEFAULT 0,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  CHECK (expect_amount >= 0 AND actual_amount >= 0)
);

CREATE TABLE payment (
  _id UUID DEFAULT uuid_generate_v7() PRIMARY KEY,
  user_id UUID DEFAULT NULL,
  source_id UUID NOT NULL REFERENCES source (_id),
  expected_amount INTEGER DEFAULT 0,
  promptpay_qr_data TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  CHECK (expected_amount >= 0)
);

CREATE TABLE payment_updatestatus (
  _id UUID DEFAULT uuid_generate_v7() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payment (_id),
  status payment_available_status DEFAULT 'waiting',
  actual_amount INTEGER DEFAULT NULL,
  staff_id UUID NOT NULL REFERENCES staff (_id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE reimbursement (
  _id UUID DEFAULT uuid_generate_v7() PRIMARY KEY,
  staff_dept_id UUID NOT NULL REFERENCES staff_dept (_id),
  tag_id UUID DEFAULT NULL REFERENCES project_tag (_id),
  purpose TEXT NOT NULL,
  tracking_id TEXT DEFAULT NULL,
  banking_id UUID DEFAULT NULL REFERENCES bankaccount (_id),
  receipt_link TEXT DEFAULT NULL,
  latest_status reimbursement_available_status DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE reimbursement_detail (
  _id UUID DEFAULT uuid_generate_v7() PRIMARY KEY,
  reimbursement_id UUID NOT NULL REFERENCES reimbursement (_id),
  title TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE reimbursement_updatestatus (
  _id UUID DEFAULT uuid_generate_v7() PRIMARY KEY,
  reimbursement_id UUID NOT NULL REFERENCES reimbursement (_id),
  status reimbursement_available_status NOT NULL,
  staff_id UUID NOT NULL REFERENCES staff (_id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes --

CREATE INDEX ON department (project_id) WHERE deleted_at IS NULL;
CREATE INDEX ON source (project_id) WHERE deleted_at IS NULL;
CREATE INDEX ON source (tag_id) WHERE deleted_at IS NULL;
CREATE INDEX ON staff_dept (staff_id) WHERE deleted_at IS NULL;
CREATE INDEX ON staff_dept (department_id) WHERE deleted_at IS NULL;
CREATE INDEX ON payment (source_id) WHERE deleted_at IS NULL;
CREATE INDEX ON payment_updatestatus (payment_id, created_at DESC);
-- CREATE INDEX ON payment_updatestatus (status) WHERE created_at > now() - interval '30 days';
CREATE INDEX ON reimbursement_updatestatus (reimbursement_id, created_at DESC);
CREATE INDEX ON reimbursement (staff_dept_id) WHERE deleted_at IS NULL;
CREATE INDEX ON reimbursement_detail (reimbursement_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ON bankaccount (number, provider);

-- Functions --

CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'project', 
    'project_tag', 
    'department', 
    'source', 
    'reimbursement', 
    'reimbursement_detail'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION sync_reimbursement_latest_status() RETURNS trigger AS $$
DECLARE
  latest reimbursement_available_status;
BEGIN
  SELECT status INTO latest
  FROM reimbursement_updatestatus
  WHERE reimbursement_id = NEW.reimbursement_id
  ORDER BY created_at DESC
  LIMIT 1;
  IF latest IS NULL THEN
    latest := 'waiting';
  END IF;
  UPDATE reimbursement
  SET latest_status = latest,
      updated_at = now()
  WHERE _id = NEW.reimbursement_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_reimbursement_latest_status
AFTER INSERT ON reimbursement_updatestatus
FOR EACH ROW EXECUTE FUNCTION sync_reimbursement_latest_status();
