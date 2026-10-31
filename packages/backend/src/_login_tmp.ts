import { queryMany } from "@/db/index.js";
import { SessionService } from "@/services/session.service.js";
const users = (await queryMany<{ id: string }>(`SELECT id FROM users WHERE phone LIKE '91000%' ORDER BY phone`)).map((u) => u.id);
const svc = new SessionService();
for (const n of [100, 300, 1000]) {
  // revoke old sessions of these users first so the session limit does not distort the test
  await Promise.all(users.slice(0, n).map((id) => svc.revokeAll(id)));
  const t0 = Date.now();
  const made = await Promise.all(users.slice(0, n).map((id) => svc.create(id, { device_type: "mobile", device_info: {}, ip_address: "127.0.0.1" })));
  const createMs = Date.now() - t0;
  const t1 = Date.now();
  await Promise.all(made.map((m) => svc.refresh(m.tokens.refreshToken, m.session.id).catch(() => null)));
  const refreshMs = Date.now() - t1;
  console.log(`${String(n).padStart(4)} simultaneous logins on 1 core: ${(createMs / 1000).toFixed(1)}s (${Math.round(n / (createMs / 1000))}/s)  |  then ${n} token refreshes (app re-open): ${(refreshMs / 1000).toFixed(1)}s (${Math.round(n / (refreshMs / 1000))}/s)`);
}
process.exit(0);
