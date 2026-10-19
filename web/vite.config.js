import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // the api only allows this origin (CORS_ORIGIN), so don't silently move to 5174
  server: { port: 5173, strictPort: true },
});
