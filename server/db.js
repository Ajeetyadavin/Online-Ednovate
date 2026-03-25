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
    CREATE TABLE IF NOT EXISTS course_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#475569',
      is_visible BOOLEAN NOT NULL DEFAULT TRUE,
      parent_id TEXT REFERENCES course_categories(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_course_categories_parent_id ON course_categories(parent_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_course_categories_sort_order ON course_categories(sort_order)");

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

  await pool.query("ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE");
  await pool.query("ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS revoked_reason TEXT");
  await pool.query("ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ");
  await pool.query("ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS replaced_by_token TEXT");
  await pool.query("ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS login_ip TEXT");
  await pool.query("ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS login_user_agent TEXT");

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

  await pool.query("ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE");
  await pool.query("ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS revoked_reason TEXT");
  await pool.query("ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ");
  await pool.query("ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS replaced_by_token TEXT");
  await pool.query("ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS login_ip TEXT");
  await pool.query("ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS login_user_agent TEXT");

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
  await pool.query("ALTER TABLE student_course_access ADD COLUMN IF NOT EXISTS preferred_video_quality TEXT NOT NULL DEFAULT 'auto'");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_orders (
      id BIGSERIAL PRIMARY KEY,
      order_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      shipping_address_line1 TEXT,
      shipping_address_line2 TEXT,
      shipping_city TEXT,
      shipping_state TEXT,
      shipping_country TEXT,
      shipping_pincode TEXT,
      course_id TEXT NOT NULL,
      course_title TEXT NOT NULL,
      parent_package_id TEXT,
      parent_package_title TEXT,
      package_course_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      order_date DATE,
      payment_method TEXT,
      base_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'completed',
      item_type TEXT NOT NULL DEFAULT 'course',
      mode_label TEXT,
      book_label TEXT,
      is_ebook BOOLEAN NOT NULL DEFAULT FALSE,
      dispatch_status TEXT NOT NULL DEFAULT 'pending',
      tracking_id TEXT,
      dispatch_note TEXT,
      dispatched_at TIMESTAMPTZ,
      refund_note TEXT,
      refunded_at TIMESTAMPTZ,
      refunded_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(order_id, student_id, course_id)
    );
  `);

  await pool.query("ALTER TABLE student_orders ADD COLUMN IF NOT EXISTS parent_package_id TEXT");
  await pool.query("ALTER TABLE student_orders ADD COLUMN IF NOT EXISTS parent_package_title TEXT");
  await pool.query("ALTER TABLE student_orders ADD COLUMN IF NOT EXISTS package_course_ids JSONB NOT NULL DEFAULT '[]'::jsonb");
  await pool.query("ALTER TABLE student_orders ADD COLUMN IF NOT EXISTS customer_name TEXT");
  await pool.query("ALTER TABLE student_orders ADD COLUMN IF NOT EXISTS customer_email TEXT");
  await pool.query("ALTER TABLE student_orders ADD COLUMN IF NOT EXISTS customer_phone TEXT");
  await pool.query("ALTER TABLE student_orders ADD COLUMN IF NOT EXISTS shipping_address_line1 TEXT");
  await pool.query("ALTER TABLE student_orders ADD COLUMN IF NOT EXISTS shipping_address_line2 TEXT");
  await pool.query("ALTER TABLE student_orders ADD COLUMN IF NOT EXISTS shipping_city TEXT");
  await pool.query("ALTER TABLE student_orders ADD COLUMN IF NOT EXISTS shipping_state TEXT");
  await pool.query("ALTER TABLE student_orders ADD COLUMN IF NOT EXISTS shipping_country TEXT");
  await pool.query("ALTER TABLE student_orders ADD COLUMN IF NOT EXISTS shipping_pincode TEXT");
  await pool.query("ALTER TABLE student_orders ADD COLUMN IF NOT EXISTS base_amount NUMERIC(12,2) NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE student_orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE student_orders ADD COLUMN IF NOT EXISTS refund_note TEXT");
  await pool.query("ALTER TABLE student_orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ");
  await pool.query("ALTER TABLE student_orders ADD COLUMN IF NOT EXISTS refunded_by TEXT");

  await pool.query("CREATE INDEX IF NOT EXISTS idx_student_orders_student ON student_orders(student_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_student_orders_order ON student_orders(order_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_student_orders_dispatch_status ON student_orders(dispatch_status)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_student_orders_parent_package_id ON student_orders(parent_package_id)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lead_form_settings (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    INSERT INTO lead_form_settings (id, data)
    VALUES (1, '{}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS enquiry_leads (
      id BIGSERIAL PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'enquiry_now',
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      mobile TEXT NOT NULL,
      email TEXT,
      streams JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'fresh',
      enquiry_message TEXT,
      extra_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_follow_up_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query("ALTER TABLE enquiry_leads ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'enquiry_now'");
  await pool.query("ALTER TABLE enquiry_leads ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE enquiry_leads ADD COLUMN IF NOT EXISTS email TEXT");
  await pool.query("ALTER TABLE enquiry_leads ADD COLUMN IF NOT EXISTS streams JSONB NOT NULL DEFAULT '[]'::jsonb");
  await pool.query("ALTER TABLE enquiry_leads ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'fresh'");
  await pool.query("ALTER TABLE enquiry_leads ADD COLUMN IF NOT EXISTS enquiry_message TEXT");
  await pool.query("ALTER TABLE enquiry_leads ADD COLUMN IF NOT EXISTS extra_data JSONB NOT NULL DEFAULT '{}'::jsonb");
  await pool.query("ALTER TABLE enquiry_leads ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMPTZ");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lead_follow_ups (
      id BIGSERIAL PRIMARY KEY,
      lead_id BIGINT NOT NULL REFERENCES enquiry_leads(id) ON DELETE CASCADE,
      comment_text TEXT NOT NULL,
      next_follow_up_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'follow_up',
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_enquiry_leads_created_at ON enquiry_leads(created_at DESC)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_enquiry_leads_status ON enquiry_leads(status)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_enquiry_leads_mobile ON enquiry_leads(mobile)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_lead_id ON lead_follow_ups(lead_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_created_at ON lead_follow_ups(created_at DESC)");

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
    CREATE TABLE IF NOT EXISTS student_lesson_notes (
      id BIGSERIAL PRIMARY KEY,
      student_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      chapter_title TEXT,
      lesson_title TEXT,
      note_text TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(student_id, course_id, lesson_id)
    );
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_student_lesson_notes_student ON student_lesson_notes(student_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_student_lesson_notes_course ON student_lesson_notes(course_id)");

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS faculty_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      photo_url TEXT,
      about TEXT,
      course_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_faculty_profiles_active ON faculty_profiles(is_active)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_faculty_profiles_sort ON faculty_profiles(sort_order)");

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
