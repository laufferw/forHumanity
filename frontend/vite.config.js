import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Keep the REACT_APP_ prefix from Create React App so existing env files,
  // Docker build args, and CI keep working.
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: { port: 3000 },
  preview: { port: 3000 },
  // `build/` matches the Dockerfile, nginx image, and e2e config.
  build: { outDir: 'build' },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
});
