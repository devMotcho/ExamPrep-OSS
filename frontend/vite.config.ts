import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';
import { SEO_PAGES, SITE_NAME, pageTitle, pageUrl } from './src/lib/config/seoPages';

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Writes static HTML with the right head and a small content shell for the public /pt
 * pages, so crawlers and link previews need no JavaScript. It is not a render of the
 * React tree: createRoot replaces the shell as soon as the app boots.
 *
 * Each page gets both pt/contact.html (found by `vite preview`) and
 * pt/contact/index.html (found by nginx's `try_files $uri $uri/`).
 */
const staticSeoPages = (siteUrl: string): Plugin => {
  let outDir = 'dist';
  return {
    name: 'static-seo-pages',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const template = fs.readFileSync(path.join(outDir, 'index.html'), 'utf-8');

      for (const page of SEO_PAGES.filter((p) => p.prerender)) {
        const { title: heading, description } = page.text.pt;
        const t = escapeHtml(pageTitle(page, 'pt'));
        const d = escapeHtml(description);
        // Absolute URLs need a known origin; without VITE_SITE_URL they are left out here and set at runtime.
        const url = siteUrl ? pageUrl('pt', page.path, siteUrl) : '';
        const head = [
          `<title>${t}</title>`,
          `<meta name="description" content="${d}" data-seo-static />`,
          ...(url ? [
            `<link rel="canonical" href="${url}" data-seo-static />`,
            `<link rel="alternate" hreflang="pt" href="${url}" data-seo-static />`,
            `<link rel="alternate" hreflang="en" href="${pageUrl('en', page.path, siteUrl)}" data-seo-static />`,
            `<link rel="alternate" hreflang="x-default" href="${url}" data-seo-static />`,
            `<meta property="og:url" content="${url}" data-seo-static />`,
          ] : []),
          `<meta property="og:type" content="website" data-seo-static />`,
          `<meta property="og:site_name" content="${SITE_NAME}" data-seo-static />`,
          `<meta property="og:locale" content="pt_PT" data-seo-static />`,
          `<meta property="og:title" content="${t}" data-seo-static />`,
          `<meta property="og:description" content="${d}" data-seo-static />`,
          `<meta name="twitter:card" content="summary" data-seo-static />`,
        ].join('\n    ');
        const links = SEO_PAGES.filter((p) => p.prerender && p !== page)
          .map((p) => `<li><a href="/pt${p.path}">${escapeHtml(p.text.pt.title)}</a></li>`)
          .join('');
        const shell =
          `<main style="max-width:48rem;margin:0 auto;padding:6rem 1.5rem">` +
          `<h1 style="font-size:2.25rem;font-weight:800;margin-bottom:1rem">${escapeHtml(heading)}</h1>` +
          `<p>${d}</p><ul style="margin-top:1rem">${links}</ul></main>`;

        const html = template
          .replace(/<!-- seo:start -->[\s\S]*<!-- seo:end -->/, head)
          .replace('<div id="root"></div>', `<div id="root">${shell}</div>`);

        const base = path.join(outDir, 'pt', page.path.replace(/^\//, ''));
        fs.mkdirSync(base, { recursive: true });
        fs.writeFileSync(path.join(base, 'index.html'), html);
        fs.writeFileSync(`${base}.html`, html);
      }

      fs.writeFileSync(
        path.join(outDir, 'index.html'),
        template.replace(/\s*<!-- seo:(start|end) -->/g, ''),
      );
    },
  };
};

const CHUNK_GROUPS: [string, RegExp][] = [
  // use-sync-external-store is shared with base-ui; left unlisted, Rollup pulls it into vendor-editor.
  ['vendor-react', /node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run|use-sync-external-store)\//],
  ['vendor-i18n', /node_modules\/(i18next|react-i18next|html-parse-stringify|void-elements)\//],
  ['vendor-icons', /node_modules\/lucide-react\//],
  // Only used by pages that edit or render rich text, so kept out of the landing page.
  ['vendor-editor', /node_modules\/(@tiptap|prosemirror-[^/]+|orderedmap|rope-sequence|w3c-keyname|crelt|linkifyjs)\//],
  ['vendor-dnd', /node_modules\/(@hello-pangea|react-redux|redux|css-box-model|raf-schd)\//],
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Comma-separated hosts `vite preview` may answer to, e.g. VITE_ALLOWED_HOSTS=exams.example.org
  const allowedHosts = (env.VITE_ALLOWED_HOSTS || '').split(',').map((host) => host.trim()).filter(Boolean);

  return {
  plugins: [
    react(),
    staticSeoPages(env.VITE_SITE_URL || ''),
    // Only runs in `vite build`: there is no service worker in dev (devOptions stays off).
    // src/pwa/serviceWorker.ts registers it, so the update flow can respect running exams.
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false,
      // public/site.webmanifest is the manifest; index.html links to it.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,jpg,woff2,webmanifest}'],
        // The static SEO copies are only for crawlers.
        globIgnores: ['pt/**', 'en/**', 'pt.html', 'en.html', '**/*cyrillic*', '**/*vietnamese*'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(\/|$)/, /^\/oauth2(\/|$)/, /^\/login\/oauth2(\/|$)/, /\/[^/?]+\.[^/]+$/],
        // Nothing is cached at runtime: API responses, exam content and answers stay off the device.
        runtimeCaching: [
          { urlPattern: ({ url }) => /^\/api(\/|$)/.test(url.pathname), handler: 'NetworkOnly' },
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Everything not listed is left to Rollup, so it only loads with the pages that import it.
        manualChunks(id) {
          return CHUNK_GROUPS.find(([, pattern]) => pattern.test(id))?.[0];
        },
      },
    },
  },
  // `npm start` serves through `vite preview`, which answers 403 to hosts it doesn't know.
  preview: {
    allowedHosts,
  },
  server: {
    port: 5173,
    host: true
  }
  };
});
