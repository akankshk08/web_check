-- Row Level Security for AgencyOS.
--
-- The Next.js server talks to Postgres with a privileged connection and applies
-- organization/role scoping in code. RLS is the second wall: anything reaching the
-- database through Supabase's public Data API (anon / authenticated roles, e.g. with
-- the public anon key) only ever sees rows the signed-in user is allowed to see,
-- and can never write directly.

-- Local/CI shim: create Supabase's roles and auth.uid() when not running on Supabase.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $body$
        SELECT nullif(coalesce(
          current_setting('request.jwt.claim.sub', true),
          (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
        ), '')::uuid
      $body$
    $fn$;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
--> statement-breakpoint

-- ---------- Helper functions (SECURITY DEFINER avoids recursive policy checks) ----------
CREATE OR REPLACE FUNCTION public.app_has_org_role(org uuid, roles org_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.organization_id = org AND m.user_id = auth.uid()
      AND m.status = 'ACTIVE' AND m.role = ANY (roles)
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.app_is_staff(org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.app_has_org_role(org, ARRAY['OWNER','ADMIN','EMPLOYEE']::org_role[]);
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.app_is_manager(org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.app_has_org_role(org, ARRAY['OWNER','ADMIN']::org_role[]);
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.app_can_view_finance(org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.organization_id = org AND m.user_id = auth.uid() AND m.status = 'ACTIVE'
      AND (m.role = 'OWNER' OR (m.role = 'ADMIN' AND m.can_manage_finances))
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.app_client_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cm.client_id FROM client_members cm
  JOIN organization_members m ON m.organization_id = cm.organization_id AND m.user_id = cm.user_id
  WHERE cm.user_id = auth.uid() AND m.status = 'ACTIVE' AND m.role = 'CLIENT';
$$;
--> statement-breakpoint
-- Staff access: owners/admins see every project in their org, employees only assigned ones.
CREATE OR REPLACE FUNCTION public.app_staff_can_access_project(project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project AND (
      public.app_is_manager(p.organization_id)
      OR (public.app_is_staff(p.organization_id) AND EXISTS (
        SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      ))
    )
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.app_client_can_access_project(project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project AND p.archived_at IS NULL
      AND p.client_id IN (SELECT public.app_client_ids())
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.app_shares_org(other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members a
    JOIN organization_members b ON a.organization_id = b.organization_id
    WHERE a.user_id = auth.uid() AND a.status = 'ACTIVE' AND b.user_id = other
  );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.app_has_org_role(uuid, org_role[]), public.app_is_staff(uuid),
  public.app_is_manager(uuid), public.app_can_view_finance(uuid), public.app_client_ids(),
  public.app_staff_can_access_project(uuid), public.app_client_can_access_project(uuid),
  public.app_shares_org(uuid) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.app_has_org_role(uuid, org_role[]), public.app_is_staff(uuid),
  public.app_is_manager(uuid), public.app_can_view_finance(uuid), public.app_client_ids(),
  public.app_staff_can_access_project(uuid), public.app_client_can_access_project(uuid),
  public.app_shares_org(uuid) TO authenticated;
--> statement-breakpoint

-- ---------- Enable RLS on every table ----------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE client_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE milestone_approvals ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE project_deliveries ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON rate_limits FROM authenticated;
--> statement-breakpoint

-- ---------- Read policies (no write policies: all writes go through the server) ----------
CREATE POLICY users_select ON users FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.app_shares_org(id));
--> statement-breakpoint
CREATE POLICY organizations_select ON organizations FOR SELECT TO authenticated
  USING (public.app_has_org_role(id, ARRAY['OWNER','ADMIN','EMPLOYEE','CLIENT']::org_role[]));
--> statement-breakpoint
CREATE POLICY organization_members_select ON organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.app_is_staff(organization_id));
--> statement-breakpoint
CREATE POLICY invitations_select ON invitations FOR SELECT TO authenticated
  USING (public.app_is_manager(organization_id));
--> statement-breakpoint
CREATE POLICY clients_select ON clients FOR SELECT TO authenticated
  USING (public.app_is_staff(organization_id) OR id IN (SELECT public.app_client_ids()));
--> statement-breakpoint
CREATE POLICY client_members_select ON client_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.app_is_manager(organization_id));
--> statement-breakpoint
CREATE POLICY projects_select ON projects FOR SELECT TO authenticated
  USING (public.app_staff_can_access_project(id) OR public.app_client_can_access_project(id));
--> statement-breakpoint
CREATE POLICY project_members_select ON project_members FOR SELECT TO authenticated
  USING (public.app_staff_can_access_project(project_id));
--> statement-breakpoint
CREATE POLICY milestones_select ON milestones FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (public.app_staff_can_access_project(project_id) OR public.app_client_can_access_project(project_id)));
--> statement-breakpoint
CREATE POLICY milestone_approvals_select ON milestone_approvals FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM milestones m WHERE m.id = milestone_id
      AND (public.app_staff_can_access_project(m.project_id) OR public.app_client_can_access_project(m.project_id))
  ));
--> statement-breakpoint
CREATE POLICY tasks_select ON tasks FOR SELECT TO authenticated
  USING (public.app_staff_can_access_project(project_id));
--> statement-breakpoint
CREATE POLICY task_comments_select ON task_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND public.app_staff_can_access_project(t.project_id)));
--> statement-breakpoint
CREATE POLICY project_comments_select ON project_comments FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (
    public.app_staff_can_access_project(project_id)
    OR (visibility = 'CLIENT' AND public.app_client_can_access_project(project_id))
  ));
--> statement-breakpoint
CREATE POLICY time_entries_select ON time_entries FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.app_is_manager(organization_id));
--> statement-breakpoint
CREATE POLICY attachments_select ON attachments FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND status = 'READY' AND (
    public.app_staff_can_access_project(project_id)
    OR (visibility = 'CLIENT' AND public.app_client_can_access_project(project_id))
  ));
--> statement-breakpoint
CREATE POLICY invoices_select ON invoices FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (
    public.app_can_view_finance(organization_id)
    OR (status <> 'DRAFT' AND client_id IN (SELECT public.app_client_ids()))
  ));
--> statement-breakpoint
CREATE POLICY invoice_items_select ON invoice_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id));
--> statement-breakpoint
CREATE POLICY payments_select ON payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id));
--> statement-breakpoint
CREATE POLICY notifications_select ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY activity_logs_select ON activity_logs FOR SELECT TO authenticated
  USING (
    public.app_is_manager(organization_id)
    OR (project_id IS NOT NULL AND public.app_staff_can_access_project(project_id))
    OR (client_visible AND project_id IS NOT NULL AND public.app_client_can_access_project(project_id))
  );
--> statement-breakpoint
CREATE POLICY support_tickets_select ON support_tickets FOR SELECT TO authenticated
  USING (public.app_is_staff(organization_id) OR client_id IN (SELECT public.app_client_ids()));
--> statement-breakpoint
CREATE POLICY project_deliveries_select ON project_deliveries FOR SELECT TO authenticated
  USING (public.app_staff_can_access_project(project_id));
--> statement-breakpoint
CREATE POLICY maintenance_records_select ON maintenance_records FOR SELECT TO authenticated
  USING (public.app_staff_can_access_project(project_id));
