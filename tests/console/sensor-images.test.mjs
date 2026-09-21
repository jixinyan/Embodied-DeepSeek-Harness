import assert from 'node:assert/strict';
import test from 'node:test';
import { sensorImageSources } from '../../apps/console/public/sensor-images.js';

const frame = {
  evidence: { id: 'camera:head', visibility: 'agent' },
  images: [{ attachmentId: 'sha256:declared-image', width: 640, height: 480 }],
};

test('sensor image URLs carry explicit run, evidence and attachment identities', () => {
  assert.deepEqual(sensorImageSources('run-documents', frame), [
    {
      src: '/api/runs/run-documents/evidence/camera%3Ahead/images/sha256%3Adeclared-image',
      label: 'View 1',
      width: 640,
      height: 480,
    },
  ]);
  const other = sensorImageSources('other-run', frame);
  assert.ok(other[0].src.startsWith('/api/runs/other-run/'));
});

test('missing images and restricted observations produce no image requests', () => {
  assert.deepEqual(sensorImageSources(undefined, null), []);
  assert.deepEqual(sensorImageSources('run', { ...frame, images: [] }), []);
  assert.deepEqual(
    sensorImageSources('run', {
      ...frame,
      evidence: { ...frame.evidence, visibility: 'debug_only' },
    }),
    [],
  );
});

test('image source construction rejects paths and oversized view batches', () => {
  for (const runId of ['../run', undefined, null, {}, 'r'.repeat(129)])
    assert.throws(() => sensorImageSources(runId, frame), /scope/);
  assert.throws(
    () =>
      sensorImageSources('run', {
        ...frame,
        images: [{ ...frame.images[0], attachmentId: '/etc/private' }],
      }),
    /identity/,
  );
  assert.throws(
    () =>
      sensorImageSources('run', {
        ...frame,
        images: Array.from({ length: 17 }, () => frame.images[0]),
      }),
    /limit/,
  );
});
