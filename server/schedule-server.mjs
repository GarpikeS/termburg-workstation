import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startScheduleService } from './schedule-service.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.SCHEDULE_PORT || 4174);

const service = await startScheduleService({
  staticRoot: process.env.SCHEDULE_STATIC_DIR || path.join(repoRoot, 'frontend', 'build'),
  dataFile: process.env.SCHEDULE_DATA_FILE || path.join(repoRoot, 'server', 'data', 'schedule.json'),
  authFile: process.env.SCHEDULE_AUTH_FILE || '',
  seedFile: path.join(repoRoot, 'frontend', 'public', 'data', 'default-schedule.json'),
  host: process.env.SCHEDULE_HOST || '0.0.0.0',
  port,
  adminToken: process.env.SCHEDULE_ADMIN_TOKEN || '',
  allowedOrigin: process.env.SCHEDULE_ALLOWED_ORIGIN || '*',
});

console.log('\nТермбург · Расписание запущено');
for (const address of service.baseUrls) {
  console.log(`  Редактор: ${address}/schedule/admin`);
  console.log(`  Экран:     ${address}/schedule/screen/1`);
}
console.log(`  Защита редактора: ${process.env.SCHEDULE_AUTH_FILE ? 'логин и пароль' : process.env.SCHEDULE_ADMIN_TOKEN ? 'ключ редактора' : 'выключена (локальный MVP)'}`);
console.log('\nДля остановки нажмите Ctrl+C.\n');

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await service.close();
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
