import React, { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { mediaUrl } from '@/api/blog';

const VIDEO_ALT = /^video:\s*/i;
const HAS_SOURCE = /^(https?:\/\/[^/\s]|\/)/i;

const isVideo = (src: string, alt: string) => VIDEO_ALT.test(alt) || /\.(mp4|webm)(\?.*)?$/i.test(src);

const headingText = (node: React.ReactNode): string =>
  React.Children.toArray(node)
    .map((child) => (React.isValidElement(child) ? headingText((child.props as { children?: React.ReactNode }).children) : String(child)))
    .join('');

export const headingId = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const extractHeadings = (markdown: string) =>
  markdown
    .replace(/```[\s\S]*?```/g, '')
    .split('\n')
    .flatMap((line) => {
      const match = /^##\s+(.+)$/.exec(line.trim());
      if (!match) return [];
      const text = match[1].replace(/[*_`]/g, '').trim();
      return [{ text, id: headingId(text) }];
    });

const components: Components = {
  h2: ({ children }) => <h2 id={headingId(headingText(children))} className="scroll-mt-24">{children}</h2>,
  h3: ({ children }) => <h3 id={headingId(headingText(children))} className="scroll-mt-24">{children}</h3>,
  a: ({ href, children }) => {
    const external = /^https?:\/\//.test(href ?? '');
    return <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>;
  },
  // A lone image is wrapped in a paragraph, which cannot hold a figure.
  p: ({ children, node }) => {
    const only = node?.children.length === 1 ? node.children[0] : undefined;
    return only && only.type === 'element' && only.tagName === 'img' ? <>{children}</> : <p>{children}</p>;
  },
  img: ({ src, alt }) => {
    const label = alt ?? '';
    const url = mediaUrl(typeof src === 'string' ? src : '');
    // A link still being written would otherwise show the browser's media error.
    if (!HAS_SOURCE.test(url)) return null;
    const video = isVideo(url, label);
    const caption = label.replace(VIDEO_ALT, '');
    return (
      <figure className="not-prose my-8">
        {video ? (
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            aria-label={caption || undefined}
            className="w-full aspect-video rounded-2xl border border-border/60 bg-muted shadow-lg"
          />
        ) : (
          <img src={url} alt={caption} loading="lazy" className="w-full rounded-2xl border border-border/60 shadow-lg" />
        )}
        {caption && <figcaption className="mt-3 text-center text-xs font-medium text-muted-foreground">{caption}</figcaption>}
      </figure>
    );
  },
};

// Raw HTML in the Markdown is not rendered, so the output needs no extra sanitising.
export const MarkdownArticle: React.FC<{ markdown: string }> = ({ markdown }) => {
  const plugins = useMemo(() => [remarkGfm], []);
  // Margins use [&_x] because the shared .prose rules in globals.css outrank the prose-x: modifiers.
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-black prose-headings:tracking-tight prose-h2:text-2xl sm:prose-h2:text-3xl prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-pre:rounded-xl prose-pre:border prose-pre:border-border/60 prose-pre:bg-muted prose-pre:text-foreground prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-medium [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-foreground [&_h2]:mt-12 [&_h2]:mb-4 [&_h3]:mt-8 [&_h3]:mb-3 [&_p]:my-4 [&_ul]:my-4 [&_ol]:my-4 [&_blockquote]:my-6 prose-blockquote:border-primary">
      <ReactMarkdown remarkPlugins={plugins} components={components} skipHtml>{markdown}</ReactMarkdown>
    </div>
  );
};
