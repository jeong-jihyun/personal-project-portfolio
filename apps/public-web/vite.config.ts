import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Public Web: /portfolio 경로에서 제공. 개발 중 /api 요청은 로컬 API(3000)로 프록시한다.
export default defineConfig({
  base: '/portfolio/',
  plugins: [react()],
  server: {
    port: 5174,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
