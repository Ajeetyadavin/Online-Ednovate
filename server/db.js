import pg from "pg";
import { createHash } from "node:crypto";

const { Pool } = pg;

const parseBoolean = (value) => String(value).toLowerCase() === "true";

const getConnectionConfig = () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    };
  }

  return {
    host: process.env.PGHOST ?? "127.0.0.1",
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? "ajeet",
    password: process.env.PGPASSWORD || undefined,
    database: process.env.PGDATABASE ?? "ednovate_db",
  };
};

export const pool = new Pool(getConnectionConfig());

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});

export async function checkDatabaseConnection() {
  const result = await pool.query(
    "SELECT NOW() AS server_time, current_database() AS database_name, current_user AS db_user"
  );

  return result.rows[0];
}

export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      mobile TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      status TEXT NOT NULL DEFAULT 'Active',
      join_date DATE NOT NULL DEFAULT CURRENT_DATE,
      courses_enrolled INTEGER NOT NULL DEFAULT 0,
      courses_completed INTEGER NOT NULL DEFAULT 0,
      bio TEXT,
      education_level TEXT,
      password TEXT NOT NULL DEFAULT 'student123',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_curricula (
      course_id TEXT PRIMARY KEY,
      chapters JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS homepage_content (
      id INTEGER PRIMARY KEY,
      banners JSONB NOT NULL DEFAULT '[]'::jsonb,
      testimonials JSONB NOT NULL DEFAULT '[]'::jsonb,
      announcements JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    INSERT INTO homepage_content (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    INSERT INTO platform_settings (id, data)
    VALUES (1, '{}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id BIGSERIAL PRIMARY KEY,
      event_type TEXT NOT NULL,
      course_id TEXT,
      user_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'sub_admin',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_login_at TIMESTAMPTZ,
      last_login_ip TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'sub_admin',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      admin_id TEXT,
      admin_email TEXT,
      action TEXT NOT NULL,
      module_key TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_course_access (
      id BIGSERIAL PRIMARY KEY,
      student_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      course_title TEXT NOT NULL,
      purchase_date DATE,
      duration_days INTEGER NOT NULL DEFAULT 30,
      expires_at TIMESTAMPTZ,
      total_views INTEGER NOT NULL DEFAULT 1,
      is_unlimited_views BOOLEAN NOT NULL DEFAULT FALSE,
      used_views INTEGER NOT NULL DEFAULT 0,
      course_duration_seconds INTEGER NOT NULL DEFAULT 0,
      allowed_watch_seconds INTEGER NOT NULL DEFAULT 0,
      used_watch_seconds INTEGER NOT NULL DEFAULT 0,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(student_id, course_id)
    );
  `);

  await pool.query("ALTER TABLE student_course_access ADD COLUMN IF NOT EXISTS course_duration_seconds INTEGER NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE student_course_access ADD COLUMN IF NOT EXISTS allowed_watch_seconds INTEGER NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE student_course_access ADD COLUMN IF NOT EXISTS used_watch_seconds INTEGER NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE student_course_access ADD COLUMN IF NOT EXISTS is_unlimited_views BOOLEAN NOT NULL DEFAULT FALSE");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_login_logs (
      id BIGSERIAL PRIMARY KEY,
      student_id TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      source TEXT NOT NULL DEFAULT 'student_login',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_video_activity (
      id BIGSERIAL PRIMARY KEY,
      student_id TEXT NOT NULL,
      course_id TEXT,
      chapter_title TEXT,
      lesson_title TEXT,
      progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
      viewed_seconds INTEGER NOT NULL DEFAULT 0,
      last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_lesson_views (
      id BIGSERIAL PRIMARY KEY,
      student_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      chapter_title TEXT,
      lesson_title TEXT,
      first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(student_id, course_id, lesson_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_notifications (
      id BIGSERIAL PRIMARY KEY,
      student_id TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'in_app',
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      sent_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS technical_support_tickets (
      id BIGSERIAL PRIMARY KEY,
      ticket_code TEXT UNIQUE NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      student_email TEXT NOT NULL,
      course_id TEXT NOT NULL,
      course_title TEXT NOT NULL,
      subject TEXT NOT NULL,
      issue_category TEXT NOT NULL DEFAULT 'other',
      priority TEXT NOT NULL DEFAULT 'medium',
      lesson_title TEXT,
      issue_details TEXT NOT NULL,
      screenshot_url TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      last_reply_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS technical_support_messages (
      id BIGSERIAL PRIMARY KEY,
      ticket_id BIGINT NOT NULL REFERENCES technical_support_tickets(id) ON DELETE CASCADE,
      sender_role TEXT NOT NULL,
      sender_id TEXT,
      sender_name TEXT,
      message TEXT NOT NULL,
      attachment_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_support_tickets_student ON technical_support_tickets(student_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON technical_support_tickets(status)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON technical_support_tickets(priority)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_support_tickets_course ON technical_support_tickets(course_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON technical_support_messages(ticket_id)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketing_campaigns (
      id BIGSERIAL PRIMARY KEY,
      campaign_key TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      content_type TEXT NOT NULL DEFAULT 'text',
      media_url TEXT,
      cta_text TEXT,
      cta_url TEXT,
      page_scope TEXT NOT NULL DEFAULT 'global',
      page_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
      target_student_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      target_course_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      target_subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
      target_languages JSONB NOT NULL DEFAULT '[]'::jsonb,
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      show_delay_seconds INTEGER NOT NULL DEFAULT 0,
      repeat_after_close_minutes INTEGER NOT NULL DEFAULT 0,
      max_impressions_per_user INTEGER NOT NULL DEFAULT 0,
      is_dismissible BOOLEAN NOT NULL DEFAULT TRUE,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_by TEXT,
      updated_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketing_campaign_events (
      id BIGSERIAL PRIMARY KEY,
      campaign_id BIGINT NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      student_id TEXT,
      session_id TEXT,
      path_name TEXT,
      event_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_enabled ON marketing_campaigns(is_enabled)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_schedule ON marketing_campaigns(starts_at, ends_at)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_marketing_events_campaign ON marketing_campaign_events(campaign_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_marketing_events_student ON marketing_campaign_events(student_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_marketing_events_session ON marketing_campaign_events(session_id)");

  const superAdminEmail = String(process.env.ADMIN_EMAIL || "admin@ednovate.com").trim().toLowerCase();
  const superAdminPassword = String(process.env.ADMIN_PASSWORD || "admin123");
  const superAdminName = String(process.env.ADMIN_NAME || "Super Admin").trim();
  const superAdminHash = createHash("sha256").update(superAdminPassword).digest("hex");

  await pool.query(
    `
    INSERT INTO admin_accounts (id, name, email, password_hash, role, is_active, permissions, created_by)
    VALUES ($1, $2, $3, $4, 'super_admin', TRUE, '{}'::jsonb, 'system')
    ON CONFLICT (id)
    DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      password_hash = EXCLUDED.password_hash,
      role = 'super_admin',
      is_active = TRUE,
      updated_at = NOW()
    `,
    ["super-admin", superAdminName || "Super Admin", superAdminEmail, superAdminHash],
  );

  const seedCountResult = await pool.query("SELECT COUNT(*)::int AS count FROM students");
  if ((seedCountResult.rows[0]?.count || 0) === 0) {
    await pool.query(
      `
      INSERT INTO students
      (id, name, email, mobile, city, state, country, status, courses_enrolled, courses_completed, education_level)
      VALUES
      ('std-1', 'Raj Kumar', 'raj@example.com', '9876543210', 'Delhi', 'Delhi', 'India', 'Active', 3, 1, '12th Pass'),
      ('std-2', 'Priya Singh', 'priya@example.com', '9123456789', 'Mumbai', 'Maharashtra', 'India', 'Active', 2, 0, 'Bachelor'),
      ('std-3', 'Arjun Patel', 'arjun@example.com', '9012345678', 'Bangalore', 'Karnataka', 'India', 'Inactive', 1, 1, 'Masters')
      ON CONFLICT (id) DO NOTHING;
      `,
    );
  }
}
