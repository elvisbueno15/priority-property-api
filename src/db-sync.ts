import { promises as fs } from 'fs';
import * as path from 'path';
import { DATA_DIR } from './data-dir.util';

/**
 * Durable storage without touching any service.
 *
 * Every domain already persists its state to a JSON file under DATA_DIR. This
 * module mirrors those files to a Supabase Postgres `kv_store` table:
 *   - on boot: restore each file FROM Postgres (so a fresh/restarted container
 *     comes back with the real data instead of empty files),
 *   - every few seconds: push any changed file back TO Postgres.
 *
 * If DATABASE_URL is unset, or Postgres can't be reached, everything silently
 * keeps working against the local files exactly as before — a DB problem can
 * never take the app down.
 */
const FILES = ['users.json', 'tracking.json', 'chat.json', 'meetings.json', 'feedback.json'];
let sql: any = null;
const lastPushed: Record<string, string> = {};

export async function restoreFromDb(): Promise<boolean> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('[db-sync] No DATABASE_URL — local files only (data is ephemeral).');
    return false;
  }
  try {
    const postgres = require('postgres');
    sql = postgres(url, { ssl: 'require', max: 3, idle_timeout: 20, connect_timeout: 15 });
    await sql`create table if not exists kv_store (
      key text primary key,
      value jsonb not null,
      updated_at timestamptz not null default now()
    )`;
    await fs.mkdir(DATA_DIR, { recursive: true });
    let restored = 0;
    for (const f of FILES) {
      const rows = await sql`select value from kv_store where key = ${f}`;
      if (rows.length) {
        const text = JSON.stringify(rows[0].value, null, 2);
        await fs.writeFile(path.join(DATA_DIR, f), text, 'utf-8');
        lastPushed[f] = text;
        restored++;
      }
    }
    console.log(`[db-sync] Supabase connected — restored ${restored} file(s). Data is durable.`);
    return true;
  } catch (e: any) {
    console.error('[db-sync] Postgres unavailable, using local files:', e?.message || e);
    sql = null;
    return false;
  }
}

async function pushOnce() {
  if (!sql) return;
  for (const f of FILES) {
    let raw: string;
    try { raw = await fs.readFile(path.join(DATA_DIR, f), 'utf-8'); }
    catch { continue; }                 // file not created yet
    if (lastPushed[f] === raw) continue; // unchanged since last push
    try {
      const value = JSON.parse(raw);
      await sql`
        insert into kv_store (key, value, updated_at)
        values (${f}, ${sql.json(value)}, now())
        on conflict (key) do update set value = excluded.value, updated_at = now()`;
      lastPushed[f] = raw;
    } catch (e: any) {
      console.error('[db-sync] push failed for', f, e?.message || e);
    }
  }
}

export function startDbSync() {
  if (!sql) return;
  setInterval(() => { pushOnce().catch(() => {}); }, 4000);
  // Best-effort final flush on shutdown.
  const flush = () => { pushOnce().catch(() => {}); };
  process.on('SIGTERM', flush);
  process.on('SIGINT', flush);
}
