import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// Path from apps/docs to root docs folder
const newsDirectory = path.join(process.cwd(), '../../docs');

export interface NewsPost {
  slug: string;
  title: string;
  date: string;
  version?: string;
  author?: string;
  excerpt?: string;
  content: string;
  path: string;
}

export function getNewsPost(slug: string): NewsPost | null {
  try {
    // Map slug to actual filename
    const filenameMap: Record<string, string> = {
      'progress-tracking': 'PROGRESS_TRACKING.md',
    };
    
    const filename = filenameMap[slug] || `${slug}.md`;
    const fullPath = path.join(newsDirectory, filename);
    
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);
    
    return {
      slug,
      title: data.title || extractTitleFromContent(content) || slug,
      date: data.date || data.publishedDate || new Date().toISOString(),
      version: data.version,
      author: data.author || 'CryptoArt Team',
      excerpt: data.excerpt || data.description || extractExcerpt(content),
      content,
      path: filename,
    };
  } catch (error) {
    console.error(`Error reading news post ${slug}:`, error);
    return null;
  }
}

export function getAllNewsPosts(): NewsPost[] {
  const posts: NewsPost[] = [];
  
  // Define news posts manually for now
  const newsPosts = [
    { slug: 'progress-tracking', filename: 'PROGRESS_TRACKING.md' },
  ];
  
  for (const post of newsPosts) {
    const newsPost = getNewsPost(post.slug);
    if (newsPost) {
      posts.push(newsPost);
    }
  }
  
  // Sort by date, newest first
  return posts.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });
}

function extractTitleFromContent(content: string): string | null {
  // Try to extract the first H1 heading
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : null;
}

function extractExcerpt(content: string, maxLength: number = 200): string {
  // Remove markdown headers and get first paragraph
  const withoutHeaders = content.replace(/^#+\s+.+$/gm, '');
  const firstParagraph = withoutHeaders.split('\n\n').find(p => p.trim().length > 0) || '';
  const cleaned = firstParagraph.replace(/[#*_`]/g, '').trim();
  
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  
  return cleaned.substring(0, maxLength).trim() + '...';
}

