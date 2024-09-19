// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://louisescher.github.io',
  base: '/studiocms-login-test',
  vite: {
    optimizeDeps: {
      exclude: ['three']
    }
  }
});
