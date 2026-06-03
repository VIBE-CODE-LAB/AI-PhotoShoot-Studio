import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProd = mode === 'production';
    return {
      base: isProd ? '/ai-photoshoot-studio/' : '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        open: true,
        allowedHosts: ['trafficable-sanjuana-frontoparietal.ngrok-free.dev'],
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

