import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Admin Web: /admin 경로에서 제공. 개발 중 /api 요청은 로컬 API(3000)로 프록시한다.
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
