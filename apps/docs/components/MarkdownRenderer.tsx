'use client';

import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const components: Components = {
    img: ({ node, ...props }) => {
      // eslint-disable-next-line @next/next/no-img-element
      return <img {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} alt={props.alt || ''} />;
    },
    a: ({ node, ...props }) => {
      const href = props.href || '';
      // For relative links, we need to handle them specially
      if (href.startsWith('http://') || href.startsWith('https://')) {
        return <a {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)} target="_blank" rel="noopener noreferrer" />;
      }
      return <a {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)} />;
    },
  };

  return (
    <div className="markdown">
      <ReactMarkdown components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

