import fs from 'node:fs/promises';

export async function readJsonFile(path) {
  return JSON.parse(await fs.readFile(path, 'utf8'));
}

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new Error('manifest must be an object');
  if (!manifest.interfaceId) throw new Error('manifest.interfaceId is required');
  if (!manifest.capture?.url) throw new Error('manifest.capture.url is required');
  if (!manifest.capture?.rootSelector) throw new Error('manifest.capture.rootSelector is required');
  if (!Number.isFinite(manifest.capture.widthCss) || !Number.isFinite(manifest.capture.heightCss)) {
    throw new Error('manifest.capture.widthCss and heightCss must be finite numbers');
  }
  if (!Array.isArray(manifest.sections) || manifest.sections.length === 0) {
    throw new Error('manifest.sections must be a non-empty array');
  }
  const seen = new Set();
  for (const section of manifest.sections) {
    if (!section.id || !section.selector) throw new Error('every section needs id and selector');
    if (seen.has(section.id)) throw new Error(`duplicate section id: ${section.id}`);
    seen.add(section.id);
  }
  return manifest;
}
