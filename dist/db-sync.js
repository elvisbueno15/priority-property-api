"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.restoreFromDb = restoreFromDb;
exports.startDbSync = startDbSync;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const data_dir_util_1 = require("./data-dir.util");
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
const FILES = ['users.json', 'tracking.json', 'chat.json', 'meetings.json', 'feedback.json', 'attachments.json'];
let sql = null;
const lastPushed = {};
async function restoreFromDb() {
    const url = process.env.DATABASE_URL;
    if (!url) {
        console.log('[db-sync] No DATABASE_URL — local files only (data is ephemeral).');
        return false;
    }
    try {
        const postgres = require('postgres');
        sql = postgres(url, { ssl: 'require', max: 3, idle_timeout: 20, connect_timeout: 15 });
        await sql `create table if not exists kv_store (
      key text primary key,
      value jsonb not null,
      updated_at timestamptz not null default now()
    )`;
        await fs_1.promises.mkdir(data_dir_util_1.DATA_DIR, { recursive: true });
        let restored = 0;
        for (const f of FILES) {
            const rows = await sql `select value from kv_store where key = ${f}`;
            if (rows.length) {
                const text = JSON.stringify(rows[0].value, null, 2);
                await fs_1.promises.writeFile(path.join(data_dir_util_1.DATA_DIR, f), text, 'utf-8');
                lastPushed[f] = text;
                restored++;
            }
        }
        console.log(`[db-sync] Supabase connected — restored ${restored} file(s). Data is durable.`);
        return true;
    }
    catch (e) {
        console.error('[db-sync] Postgres unavailable, using local files:', e?.message || e);
        sql = null;
        return false;
    }
}
async function pushOnce() {
    if (!sql)
        return;
    for (const f of FILES) {
        let raw;
        try {
            raw = await fs_1.promises.readFile(path.join(data_dir_util_1.DATA_DIR, f), 'utf-8');
        }
        catch {
            continue;
        } // file not created yet
        if (lastPushed[f] === raw)
            continue; // unchanged since last push
        try {
            const value = JSON.parse(raw);
            await sql `
        insert into kv_store (key, value, updated_at)
        values (${f}, ${sql.json(value)}, now())
        on conflict (key) do update set value = excluded.value, updated_at = now()`;
            lastPushed[f] = raw;
        }
        catch (e) {
            console.error('[db-sync] push failed for', f, e?.message || e);
        }
    }
}
function startDbSync() {
    if (!sql)
        return;
    setInterval(() => { pushOnce().catch(() => { }); }, 4000);
    // Best-effort final flush on shutdown.
    const flush = () => { pushOnce().catch(() => { }); };
    process.on('SIGTERM', flush);
    process.on('SIGINT', flush);
}
//# sourceMappingURL=db-sync.js.map