// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Change this to the final custom domain before going live.
// Cloudflare Pages will still build fine with this placeholder.
const SITE = 'https://dgf-vaesteras.pages.dev';

export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  integrations: [sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
});
