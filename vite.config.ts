import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, copyFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function copyPublicAssets(): Plugin {
  return {
    name: 'copy-public-assets',
    apply: 'build',
    closeBundle() {
      const src = resolve(__dirname, 'public');
      const dest = resolve(__dirname, 'dist');
      try {
        mkdirSync(dest, { recursive: true });
        const entries = readdirSync(src);
        for (const name of entries) {
          if (name.includes(' copy')) continue;
          try {
            const srcPath = resolve(src, name);
            const s = statSync(srcPath);
            if (!s.isFile()) continue;
            copyFileSync(srcPath, resolve(dest, name));
          } catch {
            // ignore unreadable files
          }
        }
      } catch {
        // ignore
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyPublicAssets()],
  publicDir: false,
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
