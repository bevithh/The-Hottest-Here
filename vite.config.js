import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const OVERLAY_DIR = path.resolve('public/presentation_pngs');

/**
 * `virtual:overlays` maps 'presentation_pngs/<city>/...png' -> image URL.
 * Offline build: every overlay PNG is embedded as a base64 data URI, so the whole
 * app is ONE index.html that works even if opened straight from inside the zip.
 * Normal build/dev: empty map, images load from public/ as usual.
 */
function overlaysPlugin(embed) {
  const id = 'virtual:overlays';
  return {
    name: 'thermal-divide-overlays',
    resolveId: (source) => (source === id ? '\0' + id : null),
    load(source) {
      if (source !== '\0' + id) return null;
      const map = {};
      if (embed) {
        const walk = (dir) => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name.endsWith('.png')) {
              const key = path.relative(path.resolve('public'), full).split(path.sep).join('/');
              map[key] = `data:image/png;base64,${fs.readFileSync(full).toString('base64')}`;
            }
          }
        };
        if (fs.existsSync(OVERLAY_DIR)) walk(OVERLAY_DIR);
      }
      return `export default ${JSON.stringify(map)};`;
    },
  };
}

// `npm run build:offline` makes a single index.html that runs by double-clicking (no server):
// JS, CSS and the map overlays are all inlined, because browsers refuse to load separate
// module scripts from file:// and friends often open the file without extracting the zip.
export default defineConfig(({ mode }) => {
  const offline = mode === 'offline';
  return {
    base: './',
    plugins: offline ? [react(), overlaysPlugin(true), viteSingleFile()] : [react(), overlaysPlugin(false)],
    // Offline: don't copy public/ (the PNGs are already inside index.html)
    publicDir: offline ? false : 'public',
    build: offline ? { outDir: 'offline/ThermalDivide', emptyOutDir: true } : {},
  };
});
