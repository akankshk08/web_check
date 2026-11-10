CREATE TYPE "public"."approval_action" AS ENUM('SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED', 'FEEDBACK');--> statement-breakpoint
CREATE TYPE "public"."attachment_status" AS ENUM('PENDING', 'READY');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('LEAD', 'ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."maintenance_type" AS ENUM('UPDATE', 'BACKUP', 'SECURITY', 'BUGFIX', 'CONTENT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('ACTIVE', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('OWNER', 'ADMIN', 'EMPLOYEE', 'CLIENT');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('BANK_TRANSFER', 'CARD', 'CASH', 'CHEQUE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('PLANNING', 'ACTIVE', 'ON_HOLD', 'IN_REVIEW', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('WEBSITE', 'WEB_APP', 'ECOMMERCE', 'MOBILE_APP', 'BRANDING', 'MAINTENANCE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'CHANGES_REQUESTED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('INTERNAL', 'CLIENT');--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "org_role" NOT NULL,
	"client_id" uuid,
	"token_hash" text NOT NULL,
	"invited_by_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_owner_not_invitable" CHECK ("invitations"."role" <> 'OWNER'),
	CONSTRAINT "invitations_client_role_consistency" CHECK (("invitations"."role" = 'CLIENT' and "invitations"."client_id" is not null) or ("invitations"."role" <> 'CLIENT' and "invitations"."client_id" is null)),
	CONSTRAINT "invitations_email_lowercase" CHECK ("invitations"."email" = lower("invitations"."email"))
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" NOT NULL,
	"status" "member_status" DEFAULT 'ACTIVE' NOT NULL,
	"can_manage_finances" boolean DEFAULT false NOT NULL,
	"weekly_capacity_hours" integer DEFAULT 40 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "org_members_capacity" CHECK ("organization_members"."weekly_capacity_hours" between 0 and 168)
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"website" text,
	"email" text,
	"phone" text,
	"address" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"default_tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"invoice_prefix" text DEFAULT 'INV' NOT NULL,
	"next_invoice_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "organizations_currency_len" CHECK (char_length("organizations"."currency") = 3),
	CONSTRAINT "organizations_tax_range" CHECK ("organizations"."default_tax_rate" >= 0 and "organizations"."default_tax_rate" <= 100)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"job_title" text,
	"phone" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email"))
);
--> statement-breakpoint
CREATE TABLE "client_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"can_approve" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company_name" text,
	"phone" text,
	"address" text,
	"notes" text,
	"status" "client_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "clients_org_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "clients_email_lowercase" CHECK ("clients"."email" = lower("clients"."email"))
);
--> statement-breakpoint
CREATE TABLE "milestone_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"milestone_id" uuid NOT NULL,
	"action" "approval_action" NOT NULL,
	"actor_id" uuid,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" date,
	"status" "milestone_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"approved_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "milestones_org_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"internal_notes" text,
	"type" "project_type" DEFAULT 'WEBSITE' NOT NULL,
	"status" "project_status" DEFAULT 'PLANNING' NOT NULL,
	"priority" "priority" DEFAULT 'MEDIUM' NOT NULL,
	"budget" numeric(12, 2),
	"start_date" date,
	"due_date" date,
	"progress" integer DEFAULT 0 NOT NULL,
	"created_by_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "projects_org_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "projects_progress_range" CHECK ("projects"."progress" between 0 and 100),
	CONSTRAINT "projects_budget_positive" CHECK ("projects"."budget" is null or "projects"."budget" >= 0),
	CONSTRAINT "projects_dates_order" CHECK ("projects"."start_date" is null or "projects"."due_date" is null or "projects"."due_date" >= "projects"."start_date")
);
--> statement-breakpoint
CREATE TABLE "project_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"visibility" "visibility" DEFAULT 'INTERNAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "project_comments_body_len" CHECK (char_length("project_comments"."body") between 1 and 5000)
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "task_comments_body_len" CHECK (char_length("task_comments"."body") between 1 and 5000)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"milestone_id" uuid,
	"parent_task_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"assignee_id" uuid,
	"priority" "priority" DEFAULT 'MEDIUM' NOT NULL,
	"status" "task_status" DEFAULT 'TODO' NOT NULL,
	"start_date" date,
	"due_date" date,
	"estimated_hours" numeric(6, 2),
	"position" integer DEFAULT 0 NOT NULL,
	"created_by_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "tasks_org_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "tasks_estimate_positive" CHECK ("tasks"."estimated_hours" is null or "tasks"."estimated_hours" >= 0),
	CONSTRAINT "tasks_dates_order" CHECK ("tasks"."start_date" is null or "tasks"."due_date" is null or "tasks"."due_date" >= "tasks"."start_date")
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"user_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"hours" numeric(5, 2) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_entries_hours_range" CHECK ("time_entries"."hours" > 0 and "time_entries"."hours" <= 24)
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"milestone_id" uuid,
	"uploaded_by_id" uuid,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"storage_path" text NOT NULL,
	"visibility" "visibility" DEFAULT 'INTERNAL' NOT NULL,
	"is_deliverable" boolean DEFAULT false NOT NULL,
	"status" "attachment_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "attachments_size_positive" CHECK ("attachments"."size_bytes" > 0),
	CONSTRAINT "attachments_deliverable_shared" CHECK (not "attachments"."is_deliverable" or "attachments"."visibility" = 'CLIENT')
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "invoice_items_quantity_positive" CHECK ("invoice_items"."quantity" > 0),
	CONSTRAINT "invoice_items_price_nonnegative" CHECK ("invoice_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"project_id" uuid,
	"number" text NOT NULL,
	"status" "invoice_status" DEFAULT 'DRAFT' NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"sent_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "invoices_org_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "invoices_amounts_nonnegative" CHECK ("invoices"."subtotal" >= 0 and "invoices"."tax_amount" >= 0 and "invoices"."total" >= 0 and "invoices"."amount_paid" >= 0),
	CONSTRAINT "invoices_tax_range" CHECK ("invoices"."tax_rate" >= 0 and "invoices"."tax_rate" <= 100),
	CONSTRAINT "invoices_dates_order" CHECK ("invoices"."due_date" >= "invoices"."issue_date")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"paid_on" date NOT NULL,
	"method" "payment_method" DEFAULT 'BANK_TRANSFER' NOT NULL,
	"reference" text,
	"notes" text,
	"recorded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_id" uuid,
	"project_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"action" text NOT NULL,
	"summary" text NOT NULL,
	"client_visible" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "maintenance_type" DEFAULT 'UPDATE' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "maintenance_status" DEFAULT 'SCHEDULED' NOT NULL,
	"scheduled_for" date,
	"completed_on" date,
	"hours" numeric(6, 2),
	"performed_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maintenance_hours_nonnegative" CHECK ("maintenance_records"."hours" is null or "maintenance_records"."hours" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"dedupe_key" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"production_url" text,
	"hosting_provider" text,
	"domain_provider" text,
	"domain_expiry" date,
	"ssl_expiry" date,
	"deployed_on" date,
	"handover_notes" text,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"project_id" uuid,
	"created_by_id" uuid,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"status" "ticket_status" DEFAULT 'OPEN' NOT NULL,
	"priority" "priority" DEFAULT 'MEDIUM' NOT NULL,
	"staff_response" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_id_users_id_fk" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_client_fk" FOREIGN KEY ("organization_id","client_id") REFERENCES "public"."clients"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_members" ADD CONSTRAINT "client_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_members" ADD CONSTRAINT "client_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_members" ADD CONSTRAINT "client_members_client_fk" FOREIGN KEY ("organization_id","client_id") REFERENCES "public"."clients"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_approvals" ADD CONSTRAINT "milestone_approvals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_approvals" ADD CONSTRAINT "milestone_approvals_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_approvals" ADD CONSTRAINT "milestone_approvals_milestone_fk" FOREIGN KEY ("organization_id","milestone_id") REFERENCES "public"."milestones"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_fk" FOREIGN KEY ("organization_id","client_id") REFERENCES "public"."clients"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_project_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."tasks"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_fk" FOREIGN KEY ("organization_id","milestone_id") REFERENCES "public"."milestones"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."tasks"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_project_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_task_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."tasks"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_milestone_fk" FOREIGN KEY ("organization_id","milestone_id") REFERENCES "public"."milestones"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_fk" FOREIGN KEY ("organization_id","invoice_id") REFERENCES "public"."invoices"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_fk" FOREIGN KEY ("organization_id","client_id") REFERENCES "public"."clients"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_fk" FOREIGN KEY ("organization_id","invoice_id") REFERENCES "public"."invoices"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_project_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_project_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_deliveries" ADD CONSTRAINT "project_deliveries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_deliveries" ADD CONSTRAINT "project_deliveries_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_deliveries" ADD CONSTRAINT "project_deliveries_project_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_client_fk" FOREIGN KEY ("organization_id","client_id") REFERENCES "public"."clients"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_project_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_hash_unique" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invitations_org_idx" ON "invitations" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "org_members_org_user_unique" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "org_members_user_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "client_members_client_user_unique" ON "client_members" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "client_members_user_idx" ON "client_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_org_email_active_unique" ON "clients" USING btree ("organization_id",lower("email")) WHERE "clients"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "clients_org_status_idx" ON "clients" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "milestone_approvals_milestone_idx" ON "milestone_approvals" USING btree ("milestone_id","created_at");--> statement-breakpoint
CREATE INDEX "milestones_project_idx" ON "milestones" USING btree ("project_id","position");--> statement-breakpoint
CREATE INDEX "milestones_org_status_idx" ON "milestones" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "project_members_project_user_unique" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "project_members_user_idx" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_org_status_idx" ON "projects" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "projects_client_idx" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "projects_org_due_idx" ON "projects" USING btree ("organization_id","due_date");--> statement-breakpoint
CREATE INDEX "project_comments_project_idx" ON "project_comments" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "task_comments_task_idx" ON "task_comments" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "tasks_project_status_idx" ON "tasks" USING btree ("project_id","status","position");--> statement-breakpoint
CREATE INDEX "tasks_assignee_status_idx" ON "tasks" USING btree ("assignee_id","status");--> statement-breakpoint
CREATE INDEX "tasks_org_due_idx" ON "tasks" USING btree ("organization_id","due_date");--> statement-breakpoint
CREATE INDEX "tasks_parent_idx" ON "tasks" USING btree ("parent_task_id");--> statement-breakpoint
CREATE INDEX "time_entries_user_date_idx" ON "time_entries" USING btree ("user_id","work_date");--> statement-breakpoint
CREATE INDEX "time_entries_project_idx" ON "time_entries" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_storage_path_unique" ON "attachments" USING btree ("storage_path");--> statement-breakpoint
CREATE INDEX "attachments_project_idx" ON "attachments" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "attachments_task_idx" ON "attachments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "attachments_milestone_idx" ON "attachments" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_idx" ON "invoice_items" USING btree ("invoice_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_org_number_unique" ON "invoices" USING btree ("organization_id","number");--> statement-breakpoint
CREATE INDEX "invoices_org_status_idx" ON "invoices" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "invoices_client_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoices_org_issue_idx" ON "invoices" USING btree ("organization_id","issue_date");--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_org_paid_idx" ON "payments" USING btree ("organization_id","paid_on");--> statement-breakpoint
CREATE INDEX "activity_logs_org_created_idx" ON "activity_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_project_created_idx" ON "activity_logs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "maintenance_records_org_idx" ON "maintenance_records" USING btree ("organization_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "maintenance_records_project_idx" ON "maintenance_records" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_dedupe_unique" ON "notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_deliveries_project_unique" ON "project_deliveries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_deliveries_org_idx" ON "project_deliveries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "support_tickets_org_status_idx" ON "support_tickets" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "support_tickets_client_idx" ON "support_tickets" USING btree ("client_id");