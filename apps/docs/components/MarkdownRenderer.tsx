'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

// Convert heading text to a URL-friendly ID
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
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
    h1: ({ node, ...props }) => {
      const text = typeof props.children === 'string' 
        ? props.children 
        : React.Children.toArray(props.children).join('');
      const id = slugify(text);
      return <h1 id={id} {...(props as React.HTMLAttributes<HTMLHeadingElement>)} />;
    },
    h2: ({ node, ...props }) => {
      const text = typeof props.children === 'string' 
        ? props.children 
        : React.Children.toArray(props.children).join('');
      const id = slugify(text);
      return <h2 id={id} {...(props as React.HTMLAttributes<HTMLHeadingElement>)} />;
    },
    h3: ({ node, ...props }) => {
      const text = typeof props.children === 'string' 
        ? props.children 
        : React.Children.toArray(props.children).join('');
      const id = slugify(text);
      return <h3 id={id} {...(props as React.HTMLAttributes<HTMLHeadingElement>)} />;
    },
    h4: ({ node, ...props }) => {
      const text = typeof props.children === 'string' 
        ? props.children 
        : React.Children.toArray(props.children).join('');
      const id = slugify(text);
      return <h4 id={id} {...(props as React.HTMLAttributes<HTMLHeadingElement>)} />;
    },
    h5: ({ node, ...props }) => {
      const text = typeof props.children === 'string' 
        ? props.children 
        : React.Children.toArray(props.children).join('');
      const id = slugify(text);
      return <h5 id={id} {...(props as React.HTMLAttributes<HTMLHeadingElement>)} />;
    },
    h6: ({ node, ...props }) => {
      const text = typeof props.children === 'string' 
        ? props.children 
        : React.Children.toArray(props.children).join('');
      const id = slugify(text);
      return <h6 id={id} {...(props as React.HTMLAttributes<HTMLHeadingElement>)} />;
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

