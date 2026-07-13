import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE');
  return {
    server: {
      host: true,
      port: 3001,
      hmr: true,
    },
    base: env.VITE_STATIC_URL || '/',
    plugins: [
      react(),
      VitePWA({
        injectRegister: 'script-defer',
        manifest: {
          name: env.VITE_PWA_NAME,
          short_name: env.VITE_PWA_NAME,
          background_color: '#FFFFFF',
          theme_color: '#FFFFFF',
          icons: [
            {
              src: 'mail-pwa.png',
              sizes: '192x192',
              type: 'image/png',
            },
          ],
        },
        workbox: {
          disableDevLogs: true,
          globPatterns: [],
          runtimeCaching: [],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'es2022',
      outDir: env.VITE_OUT_DIR || 'dist',
      emptyOutDir: true,
    },
  };
});