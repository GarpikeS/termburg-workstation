import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFeedbackService } from './feedback-service.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const production = process.env.NODE_ENV === 'production';

const service = await startFeedbackService({
  dataFile: process.env.FEEDBACK_DATA_FILE || path.join(repoRoot, 'server', 'data', 'feedback.jsonl'),
  claimsDataFile: process.env.REWARD_CLAIMS_DATA_FILE || path.join(repoRoot, 'server', 'data', 'reward-claims.jsonl'),
  redemptionsDataFile: process.env.REWARD_REDEMPTIONS_DATA_FILE || path.join(repoRoot, 'server', 'data', 'reward-redemptions.jsonl'),
  host: process.env.FEEDBACK_HOST || '127.0.0.1',
  port: Number(process.env.FEEDBACK_PORT || 4175),
  allowedOrigin: process.env.FEEDBACK_ALLOWED_ORIGIN || '',
  cashierExportToken: process.env.CASHIER_EXPORT_TOKEN || '',
  rewardAdminToken: process.env.REWARD_ADMIN_TOKEN || '',
  dolphinConnectorToken: process.env.DOLPHIN_CONNECTOR_TOKEN || '',
  dolphinEnrollmentTokenHash: process.env.DOLPHIN_ENROLLMENT_TOKEN_HASH || '',
  dolphinSourceApiKey: process.env.DOLPHIN_SOURCE_API_KEY || '',
  dolphinSourceApiUrls: process.env.DOLPHIN_SOURCE_API_URLS || '',
  dolphinSourceApiPath: process.env.DOLPHIN_SOURCE_API_PATH || '/api/v1/barcodes/game',
  dolphinSourceApply: process.env.DOLPHIN_SOURCE_APPLY === '1',
  dolphinSourceLookbackDays: Number(process.env.DOLPHIN_SOURCE_LOOKBACK_DAYS || 2),
  dolphinSourceProfiles: {
    zelenogorsk: {
      apiKey: process.env.DOLPHIN_ZELENOGORSK_SOURCE_API_KEY || '',
      apiUrls: process.env.DOLPHIN_ZELENOGORSK_SOURCE_API_URLS || '',
      apiPath: process.env.DOLPHIN_ZELENOGORSK_SOURCE_API_PATH || '/api/v1/barcodes/game',
      apply: process.env.DOLPHIN_ZELENOGORSK_SOURCE_APPLY === '1',
      lookbackDays: Number(process.env.DOLPHIN_ZELENOGORSK_SOURCE_LOOKBACK_DAYS || 2),
    },
  },
  dolphinConnectorsDataFile: process.env.DOLPHIN_CONNECTORS_DATA_FILE || path.join(
    path.dirname(process.env.REWARD_REDEMPTIONS_DATA_FILE || path.join(repoRoot, 'server', 'data', 'reward-redemptions.jsonl')),
    'dolphin-connectors.json',
  ),
  accountOptions: {
    databaseFile: process.env.AUTH_DATA_FILE || path.join(repoRoot, 'server', 'data', 'accounts.sqlite'),
    authSecret: process.env.AUTH_SECRET || (production ? '' : 'termburg-local-development-secret-change-me'),
    secureCookies: production && process.env.AUTH_COOKIE_SECURE !== '0',
    legacyCoinCap: Number(process.env.AUTH_LEGACY_COIN_CAP || 600),
  },
});

console.log(`Термбург · обратная связь запущена на ${process.env.FEEDBACK_HOST || '127.0.0.1'}:${service.port}`);

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await service.close();
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
