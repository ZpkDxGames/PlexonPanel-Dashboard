import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyControlMessage } from '../src/adapter/control-state';
import { makeFixture } from '../src/development/fixtures';
test('virtual 30-minute reducer load keeps telemetry, console and roster within declared budgets', () => {
  const start = Date.now(); let state = makeFixture('healthy', start);
  for (let second = 1; second <= 1800; second++) {
    const capturedAt = new Date(start + second * 1000).toISOString();
    for (const kind of ['PAPER', 'HOST']) state = applyControlMessage(state, { type: 'server.event', serverId: state.serverId, agentKind: kind, agentSession: kind === 'PAPER' ? 'fixture-paper' : 'fixture-host', eventType: 'telemetry.system', body: { capturedAt, processCpuPercent: 30, hostCpuPercent: 20, jvmHeapUsedBytes: 2147483648 } });
    state = applyControlMessage(state, { type: 'server.event', serverId: state.serverId, agentKind: 'PAPER', agentSession: 'fixture-paper', eventType: 'telemetry.server', body: { capturedAt, tps: [19.9,20,20], averageTickMillis: 30 } });
    state = applyControlMessage(state, { type: 'server.event', serverId: state.serverId, agentKind: 'HOST', agentSession: 'fixture-host', eventType: 'console.lines', body: { lines: Array.from({length:100}, (_, i) => ({ streamSession: 'journal', sourceSequence: second * 100 + i, capturedAt, content: `synthetic ${second}:${i}`, level: 'INFO' })) } });
    assert.ok(state.history.length <= 8192); assert.ok(state.console.length <= 2500); assert.ok(state.players.length <= 512);
  }
  assert.equal(state.console.length, 2500);
  assert.ok(state.history.length >= 1700, 'valuable telemetry is retained');
});
