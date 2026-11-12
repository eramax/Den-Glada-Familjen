import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://den-glada-familjen.pages.dev');
  const sitemap = new URL('sitemap-index.xml', base).href;

  return new Response(
    `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${sitemap}\n`,
    {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
