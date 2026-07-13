import { useEffect, useRef } from 'react';

interface ShadowHtmlProps {
  html: string;
}

function buildShadowContent(html: string): string {
  const bodyStyleRegex = /<body[^>]*style="([^"]*)"[^>]*>/i;
  const bodyStyleMatch = html.match(bodyStyleRegex);
  const bodyStyle = bodyStyleMatch ? bodyStyleMatch[1] : '';
  const cleanedHtml = html.replace(/<\/?body[^>]*>/gi, '');

  return `
    <style>
      :host {
        all: initial;
        width: 100%;
        height: 100%;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                    'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: oklch(0.145 0.005 250);
        word-break: break-word;
      }
      h1, h2, h3, h4 { font-size: 18px; font-weight: 700; }
      p { margin: 0; }
      a { text-decoration: none; color: oklch(0.6 0.18 250); }
      .shadow-content {
        background: transparent;
        width: fit-content;
        height: fit-content;
        min-width: 100%;
        ${bodyStyle || ''}
      }
      img:not(table img) { max-width: 100%; height: auto !important; }
    </style>
    <div class="shadow-content">
      ${cleanedHtml}
    </div>
  `;
}

export default function ShadowHtml({ html }: ShadowHtmlProps) {
  const contentBoxRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!shadowRef.current) {
      shadowRef.current = containerRef.current.attachShadow({ mode: 'open' });
    }
    const shadow = shadowRef.current;
    shadow.innerHTML = buildShadowContent(html);
    autoScale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  function autoScale() {
    const shadow = shadowRef.current;
    const parent = contentBoxRef.current;
    if (!shadow || !parent) return;
    const shadowContent = shadow.querySelector<HTMLElement>('.shadow-content');
    if (!shadowContent) return;
    const parentWidth = parent.offsetWidth;
    const childWidth = shadowContent.scrollWidth;
    if (childWidth === 0) return;
    const scale = parentWidth / childWidth;
    (shadow.host as HTMLElement).style.zoom = String(scale);
  }

  return (
    <div ref={contentBoxRef} className="h-full w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
