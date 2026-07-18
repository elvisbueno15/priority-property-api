"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startKeepAlive = startKeepAlive;
/**
 * Render's free tier spins the instance down after ~15 minutes without
 * inbound traffic, so the next person to open the app waits ~60s for a cold
 * start. Pinging our own public URL every 10 minutes counts as inbound
 * traffic and keeps the instance awake around the clock (one free service
 * running 24/7 fits within Render's 750 free hours/month).
 *
 * RENDER_EXTERNAL_URL is set automatically by Render; locally (or on any
 * other host) it is absent and this is a no-op.
 */
function startKeepAlive() {
    const url = process.env.RENDER_EXTERNAL_URL;
    if (!url)
        return;
    setInterval(() => {
        fetch(`${url}/health`).catch(() => { });
    }, 10 * 60 * 1000);
    console.log(`[keep-alive] pinging ${url}/health every 10 min so the free instance never sleeps.`);
}
//# sourceMappingURL=keep-alive.js.map