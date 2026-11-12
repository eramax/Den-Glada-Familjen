// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Cloudflare Pages provides CF_PAGES_URL automatically.
// For a custom domain, set SITE_URL in the Pages project environment variables.
const SITE =
  process.env.SITE_URL ||
  process.env.CF_PAGES_URL ||
  'https://den-glada-familjen.pages.dev';

export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/admin'),
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
});
