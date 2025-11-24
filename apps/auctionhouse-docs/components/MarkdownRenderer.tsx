'use client';

import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown">
      <ReactMarkdown
        components={{
          // Custom renderers for specific elements if needed
          img: ({ node, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img {...props} alt={props.alt || ''} />
          ),
          a: ({ node, ...props }) => {
            const href = props.href || '';
            // For relative links, we need to handle them specially
            if (href.startsWith('http://') || href.startsWith('https://')) {
              return <a {...props} target="_blank" rel="noopener noreferrer" />;
            }
            return <a {...props} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

