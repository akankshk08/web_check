process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/agencyos_test";
process.env.CRON_SECRET ??= "test-cron-secret-0123456789-0123456789";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key-not-real";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key-not-real-000";
delete process.env.RESEND_API_KEY;
