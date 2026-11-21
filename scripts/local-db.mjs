// Local-only Postgres for development. Data lives in .localdb. Not used in production.
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";

const dir = ".localdb";
const fresh = !fs.existsSync(`${dir}/PG_VERSION`);
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port: 5433, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"] });

if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase("onboardops");
console.log("Local Postgres ready: postgresql://postgres:postgres@localhost:5433/onboardops");

const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
