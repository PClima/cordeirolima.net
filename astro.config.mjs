// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://cordeirolima.net',
  integrations: [sitemap()],
  adapter: netlify(),
  vite: {
    plugins: [tailwindcss()],
  },
});
