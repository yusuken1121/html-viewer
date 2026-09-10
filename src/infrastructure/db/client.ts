import { sql } from "drizzle-orm"
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { optionalEnv, serverEnv } from "@/lib/env"
import { logger } from "@/lib/logger"
import * as schema from "./schema"

export type Database = PostgresJsDatabase<typeof schema>

/**
 * A database handle that may be either the pool or an open transaction.
 * Repositories accept this so the same class works inside and outside a
 * `IUnitOfWork.transaction`.
 */
export type DbExecutor =
  | Database
  | Parameters<Parameters<Database["transaction"]>[0]>[0]

function createDatabase(): Database {
  const client = postgres(serverEnv("DATABASE_URL"), {
    // Serverless runtimes recycle instances; a small pool avoids exhausting
    // Postgres connections across many warm lambdas.
    max: Number(optionalEnv("DATABASE_POOL_MAX", "5")),
    prepare: false,
  })

  return drizzle(client, { schema })
}

let instance: Database | undefined

/**
 * The Drizzle client, created on first use.
 *
 * Lazy on purpose: importing this module must not require DATABASE_URL, so a
 * project that has not set up a database can still build and run the features
 * that do not touch it.
 */
export function getDb(): Database {
  instance ??= createDatabase()
  return instance
}

/**
 * Cheap liveness check for `/api/health`.
 * Swallows the reason on purpose — the endpoint is public.
 */
export async function checkDatabase(): Promise<{ ok: boolean }> {
  try {
    await getDb().execute(sql`select 1`)
    return { ok: true }
  } catch (error) {
    logger.warn("Database health check failed", { cause: String(error) })
    return { ok: false }
  }
}

export { schema }
