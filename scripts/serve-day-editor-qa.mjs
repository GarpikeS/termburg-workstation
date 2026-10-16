// Isolated browser QA; never uses an employee profile or live schedule.
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startScheduleService } from '../server/schedule-service.mjs';
const root = await mkdtemp(path.join(os.tmpdir(), 'tb-day-editor-qa-'));
const service = await startScheduleService({
  staticRoot: path.resolve('frontend/build'), seedFile: path.resolve('frontend/public/data/default-schedule.json'),
  dataFile: path.join(root, 'schedule.json'), host: '127.0.0.1', port: 4197,
  localWritesOnly: true, logger: { info() {}, error: console.error },
});
console.log(JSON.stringify({ url: `http://127.0.0.1:${service.port}/schedule/admin`, pid: process.pid }));
let closing = false;
async function stop() {
  if (closing) return;
  closing = true;
  await service.close();
  await rm(root, { recursive: true, force: true });
  process.exit(0);
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
