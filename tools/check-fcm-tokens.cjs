const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DOSY_DB_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  const r = await c.query(`
    SELECT "userId", platform, "deviceToken",
           CASE WHEN "deviceToken" IS NOT NULL THEN substring("deviceToken", 1, 20)||'...' ELSE NULL END AS token_preview,
           endpoint IS NOT NULL AS has_endpoint,
           "advanceMins", "createdAt"
    FROM medcontrol.push_subscriptions
    ORDER BY "createdAt" DESC
  `);
  console.log(`Found ${r.rows.length} subscriptions:\n`);
  for (const row of r.rows) {
    console.log(JSON.stringify(row, null, 2));
  }
  await c.end();
})();

