import "dotenv/config";
import cors from "cors";
import express from "express";

import { checkDatabaseConnection, pool } from "./db.js";

const app = express();
const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : true;

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "ednovate-node-api",
  });
});

app.get("/api/db-check", async (_request, response) => {
  try {
    const details = await checkDatabaseConnection();

    response.json({
      status: "ok",
      ...details,
    });
  } catch (error) {
    response.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Database connection failed",
    });
  }
});

const shutdown = async () => {
  await pool.end();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.listen(port, () => {
  console.log(`Node API running on http://localhost:${port}`);
  console.log("Try /api/health and /api/db-check");
});
