import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Never reset/migrate the normal project database. Provision a fresh local DB,
// run the canonical migrations and tests, then remove only the DB we created.
const source = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1'].includes(source.hostname))
  throw new Error('Integration provisioning requires a local DATABASE_URL');
const name = `ielts_mvp_${randomUUID().replaceAll('-', '')}_test`;
if (!/^ielts_mvp_[a-f0-9]{32}_test$/.test(name))
  throw new Error('Invalid disposable database name');
const target = new URL(source);
target.pathname = `/${name}`;
const connection = new pg.Client({ connectionString: source.href });
let created = false;
try {
  await connection.connect();
  await connection.query(`CREATE DATABASE "${name}"`);
  created = true;
  const env = {
    ...process.env,
    DATABASE_URL: target.href,
    CORE_TEST_DATABASE_URL: target.href,
    GRADING_WORKER_ENABLED: 'false',
    NODE_ENV: 'test',
  };
  for (const args of [
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    ['node_modules/tsx/dist/cli.mjs', 'prisma/seed.ts'],
    [
      'node_modules/vitest/vitest.mjs',
      'run',
      'src/grading/core.integration.spec.ts',
    ],
  ]) {
    const result = spawnSync(process.execPath, args, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
    });
    if (result.error || result.status !== 0) {
      process.exitCode = result.status || 1;
      break;
    }
  }
} catch (error) {
  console.error(
    'Local integration provisioning failed:',
    typeof error?.code === 'string' ? error.code : 'DATABASE_ERROR',
  );
  process.exitCode = 1;
} finally {
  if (created) {
    // FORCE disconnects only sessions attached to this randomly generated DB.
    await connection.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    console.log('Disposable integration database removed.');
  }
  await connection.end();
}
