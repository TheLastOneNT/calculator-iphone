import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      reporter: ['text', 'html'],
      provider: 'v8'
    }
  }
});
