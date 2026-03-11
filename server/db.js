import pg from "pg";

const { Pool } = pg;

const parseBoolean = (value) => String(value).toLowerCase() === "true";

const getConnectionConfig = () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ssl: parseBoolean(process.env.PGSSL) ? { rejectUnauthorized: false } : undefined,
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
