// Tests for the export-integrity rule (brief v4.0 §2 / §9 test area #4).
// Pure Node, no test framework: run with the built-in runner —
//   node --experimental-default-type=module --test apps/web/lib/exportIntegrity.test.mjs
// (the default-type flag lets the ESM `.js` module import cleanly under node --test).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ExportIntegrityError,
  formatAsOf,
  ciLabel,
  assertProvenance,
  rowHasInterval,
  assertRowsCarryInterval,
  provenanceCaption,
  toProvenancedCSV,
  toProvenancedJSON,
} from './exportIntegrity.js';

const GOOD = { modelVersion: 'Aeon · v3', asOf: '2026-06-01T10:30:49.157974Z', confidenceLevel: 0.9 };
const ROWS = [{ channel: 'Meta', incremental_outcome: { median: 57_000_000, ci_lo: 41e6, ci_hi: 73e6 } }];

test('formatAsOf renders a UTC day/month/year', () => {
  assert.equal(formatAsOf('2026-06-01T10:30:49Z'), '01 Jun 2026');
  assert.equal(formatAsOf('2026-12-31T23:00:00Z'), '31 Dec 2026');
});

test('formatAsOf rejects junk', () => {
  for (const bad of [null, undefined, '', 'not-a-date', 42]) assert.equal(formatAsOf(bad), null);
});

test('ciLabel only accepts an open-interval probability', () => {
  assert.equal(ciLabel(0.9), '90% CI');
  assert.equal(ciLabel(0.8), '80% CI');
  for (const bad of [0, 1, 1.2, -0.1, '0.9', null]) assert.equal(ciLabel(bad), null);
});

test('assertProvenance passes a complete provenance', () => {
  assert.equal(assertProvenance(GOOD), true);
});

test('assertProvenance throws naming each missing part', () => {
  const cases = [
    [{ asOf: GOOD.asOf, confidenceLevel: 0.9 }, 'modelVersion'],
    [{ modelVersion: 'v3', confidenceLevel: 0.9 }, 'asOf'],
    [{ modelVersion: 'v3', asOf: GOOD.asOf }, 'confidenceLevel'],
    [{ modelVersion: 'v3', asOf: 'bad-date', confidenceLevel: 0.9 }, 'asOf'],
    [undefined, 'modelVersion'],
  ];
  for (const [prov, needle] of cases) {
    assert.throws(() => assertProvenance(prov), (e) => e instanceof ExportIntegrityError && e.message.includes(needle));
  }
});

test('rowHasInterval finds flat and nested intervals', () => {
  assert.equal(rowHasInterval({ 'roi.ci_lo': 0.4, 'roi.ci_hi': 3.1 }), true);
  assert.equal(rowHasInterval({ roi: { ci_lo: 0.4, ci_hi: 3.1 } }), true);
  assert.equal(rowHasInterval({ est: { lower: 1, upper: 2 } }), true);
  assert.equal(rowHasInterval({ channel: 'Meta', median: 5 }), false);
  assert.equal(rowHasInterval(null), false);
});

test('assertRowsCarryInterval enforces an interval on estimate exports', () => {
  assert.equal(assertRowsCarryInterval(ROWS), true);
  assert.throws(() => assertRowsCarryInterval([{ channel: 'Meta', median: 5 }]), ExportIntegrityError);
  assert.throws(() => assertRowsCarryInterval([]), ExportIntegrityError);
});

test('provenanceCaption stamps interval + date + version', () => {
  assert.equal(provenanceCaption(GOOD), '90% CI · as of 01 Jun 2026 · model Aeon · v3');
});

test('toProvenancedCSV prepends the provenance header and keeps the data', () => {
  const csv = 'channel,incremental_outcome.ci_lo,incremental_outcome.ci_hi\nMeta,41,73';
  const out = toProvenancedCSV(csv, GOOD, { rows: ROWS });
  assert.match(out, /# Model version: Aeon · v3/);
  assert.match(out, /# As of: 01 Jun 2026/);
  assert.match(out, /90% CI/);
  assert.ok(out.endsWith(csv));
});

test('toProvenancedCSV blocks a bare export (no provenance, or no interval)', () => {
  assert.throws(() => toProvenancedCSV('a,b\n1,2', { modelVersion: 'v3' }), ExportIntegrityError);
  assert.throws(
    () => toProvenancedCSV('a,b\n1,2', GOOD, { rows: [{ a: 1 }], requireInterval: true }),
    ExportIntegrityError
  );
});

test('toProvenancedCSV can exempt pure diagnostics from the interval rule', () => {
  const out = toProvenancedCSV('max_rhat\n1.065', GOOD, { requireInterval: false });
  assert.match(out, /# Model version: Aeon · v3/);
});

test('toProvenancedJSON wraps data in a _provenance block', () => {
  const out = JSON.parse(toProvenancedJSON({ channels: ROWS }, GOOD));
  assert.equal(out._provenance.modelVersion, 'Aeon · v3');
  assert.equal(out._provenance.asOfLabel, '01 Jun 2026');
  assert.equal(out._provenance.ciLabel, '90% CI');
  assert.deepEqual(out.data.channels, ROWS);
});

test('toProvenancedJSON refuses incomplete provenance', () => {
  assert.throws(() => toProvenancedJSON({ x: 1 }, { modelVersion: 'v3' }), ExportIntegrityError);
});
