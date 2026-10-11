import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateMaintenance } from '../src/adapter/maintenance';
const settings = { schemaVersion: 1, timezone: 'America/Sao_Paulo', restart: { schedule: { enabled: true, type: 'DAILY', weekdays: [], time: '04:00' }, warningSeconds: [900,300,60,30,10], stopTimeoutSeconds: 180, startupTimeoutSeconds: 180 }, fullRestorePoint: { retentionMode: 'SINGLE_CURRENT', retentionCount: 1, restartAfter: true, canonicalFilename: 'PlexonCraft-Latest.zip', uploadTimeoutSeconds: 1800, verificationMode: 'SIZE_AND_HASH_WHEN_AVAILABLE', maximumBytes: 1099511627776, excludes: ['logs','crash-reports','cache','.cache','plugins/PlexonPanel/audit','plugins/PlexonPanel/identity','plugins/spark/tmp'] } };
test('maintenance validator rejects unsafe limits, timezone and missing mandatory exclusions', () => {
  assert.equal(validateMaintenance(settings), '');
  for (const value of [null, { ...settings, schemaVersion: 2 }, { ...settings, timezone: 'invalid' }, { ...settings, restart: { ...settings.restart, stopTimeoutSeconds: 2 } }, { ...settings, fullRestorePoint: { ...settings.fullRestorePoint, excludes: ['../identity'] } }]) assert.notEqual(validateMaintenance(value), '');
});
