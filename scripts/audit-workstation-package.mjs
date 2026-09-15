import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { extractFile, listPackage } = require('@electron/asar');
const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const unpackedArgument = process.argv.find(argument => argument.startsWith('--unpacked-directory='));
const unpackedDirectory = unpackedArgument
  ? path.resolve(unpackedArgument.slice('--unpacked-directory='.length))
  : path.join(repoRoot, 'release', 'workstation', 'win-unpacked');
const archivePath = path.join(unpackedDirectory, 'resources', 'app.asar');
const withoutGenerated = process.argv.includes('--without-generated');
const expectedLocation = cliValue('--expected-location=');
const expectedSiteLocationIds = cliValue('--expected-site-location=').split(',').filter(Boolean).sort();
const expectedAuthAccount = cliValue('--expected-auth-account=');

function cliValue(prefix) {
  return process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length) || '';
}

function normalizeArchivePath(value) {
  return String(value).replaceAll('\\', '/');
}

function readJson(relativePath) {
  return JSON.parse(extractFile(archivePath, relativePath.split('/').join(path.sep)).toString('utf8'));
}

const archiveFiles = listPackage(archivePath).map(normalizeArchivePath);
const forbiddenFile = archiveFiles.find(fileName => (
  /\.test\.mjs$/i.test(fileName)
  || /\.(?:env|pem|key|sql|7z|zip|csv|xls|xlsx)$/i.test(fileName)
  || /\/(?:credentials|pending-enrollment)\.bin$/i.test(fileName)
  || /\/dolphin-agent\.log$/i.test(fileName)
));
if (forbiddenFile) throw new Error(`Forbidden file was packaged: ${forbiddenFile}`);

const generatedFiles = archiveFiles
  .filter(fileName => fileName.startsWith('/workstation/generated/'))
  .sort();
if (withoutGenerated) {
  if (generatedFiles.length > 0) throw new Error('Public Workstation update contains generated installation credentials.');
  console.log('Workstation package audit passed: public update has no generated credentials or test files.');
  process.exit(0);
}

const expectedGeneratedFiles = [
  '/workstation/generated/device-profile.json',
  '/workstation/generated/enrollment-token.json',
  '/workstation/generated/schedule-auth-defaults.json',
  '/workstation/generated/site-sync-defaults.json',
].sort();
if (JSON.stringify(generatedFiles) !== JSON.stringify(expectedGeneratedFiles)) {
  throw new Error('Workstation Setup generated-file inventory is not exact.');
}
if (!expectedLocation || expectedSiteLocationIds.length === 0 || !expectedAuthAccount) {
  throw new Error('Expected scoped Workstation package values are required.');
}

const enrollment = readJson('workstation/generated/enrollment-token.json');
if (enrollment?.version !== 1 || !/^[a-f0-9]{64}$/.test(String(enrollment.enrollmentToken || ''))) {
  throw new Error('Workstation Setup enrollment token is invalid.');
}
const profile = readJson('workstation/generated/device-profile.json');
if (profile?.version !== 1 || profile?.locationCode !== expectedLocation) {
  throw new Error('Workstation Setup device profile is not scoped to the expected location.');
}
const siteSync = readJson('workstation/generated/site-sync-defaults.json');
const actualSiteLocationIds = Object.keys(siteSync?.locations || {}).sort();
if (siteSync?.replaceLocations !== true
  || JSON.stringify(actualSiteLocationIds) !== JSON.stringify(expectedSiteLocationIds)
  || expectedSiteLocationIds.some(locationId => {
    const connection = siteSync.locations[locationId];
    return connection?.complexCode !== expectedLocation
      || !String(connection?.endpoint || '').startsWith('https://')
      || String(connection?.token || '').length < 20;
  })) {
  throw new Error('Workstation Setup site connection scope is invalid.');
}
const scheduleAuth = readJson('workstation/generated/schedule-auth-defaults.json');
const actualManagedAccounts = [...(scheduleAuth?.managedAccounts || [])].sort();
const actualAccounts = Object.keys(scheduleAuth?.accounts || {}).sort();
if (scheduleAuth?.replaceManagedAccounts !== true
  || JSON.stringify(actualManagedAccounts) !== JSON.stringify([expectedAuthAccount])
  || JSON.stringify(actualAccounts) !== JSON.stringify([expectedAuthAccount])
  || scheduleAuth?.accounts?.[expectedAuthAccount]?.username !== expectedAuthAccount
  || Object.hasOwn(scheduleAuth, 'password')
  || Object.hasOwn(scheduleAuth.accounts[expectedAuthAccount], 'password')) {
  throw new Error('Workstation Setup schedule account scope is invalid.');
}

console.log('Workstation package audit passed: scoped credentials and file inventory are exact.');
