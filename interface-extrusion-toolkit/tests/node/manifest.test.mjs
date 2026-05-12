import test from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest } from '../../src/browser/manifest.mjs';

test('validateManifest accepts a minimal valid manifest', () => {
  const manifest = validateManifest({
    interfaceId: 'demo',
    capture: { url: 'http://example.test', rootSelector: '#root', widthCss: 1600, heightCss: 1000 },
    sections: [{ id: 'a', selector: '[data-id="a"]' }],
  });
  assert.equal(manifest.interfaceId, 'demo');
});

test('validateManifest rejects duplicate section ids', () => {
  assert.throws(
    () => validateManifest({
      interfaceId: 'demo',
      capture: { url: 'http://example.test', rootSelector: '#root', widthCss: 1600, heightCss: 1000 },
      sections: [
        { id: 'a', selector: '[data-id="a"]' },
        { id: 'a', selector: '[data-id="b"]' },
      ],
    }),
    /duplicate section id/
  );
});
