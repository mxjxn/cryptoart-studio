import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const auctionhouseDocsDirectory = path.join(process.cwd(), '../../packages/auctionhouse-contracts');
const creatorCoreDocsDirectory = path.join(process.cwd(), '../../packages/creator-core-contracts');

export interface DocFile {
  slug: string;
  title: string;
  content: string;
  path: string;
}

export function getDocContent(relativePath: string): DocFile | null {
  try {
    const fullPath = path.join(auctionhouseDocsDirectory, relativePath);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);
    
    return {
      slug: path.basename(relativePath, '.md'),
      title: data.title || extractTitleFromContent(content) || path.basename(relativePath, '.md'),
      content,
      path: relativePath,
    };
  } catch (error) {
    console.error(`Error reading file ${relativePath}:`, error);
    return null;
  }
}

export function getCreatorCoreDocContent(relativePath: string): DocFile | null {
  try {
    const fullPath = path.join(creatorCoreDocsDirectory, relativePath);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);
    
    return {
      slug: path.basename(relativePath, '.md'),
      title: data.title || extractTitleFromContent(content) || path.basename(relativePath, '.md'),
      content,
      path: relativePath,
    };
  } catch (error) {
    console.error(`Error reading Creator Core file ${relativePath}:`, error);
    return null;
  }
}

function extractTitleFromContent(content: string): string | null {
  // Try to extract the first H1 heading
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : null;
}

export function getAllDocs(): { name: string; path: string }[] {
  return [
    { name: 'README', path: 'README.md' },
    { name: 'Capabilities', path: 'CAPABILITIES.md' },
    { name: 'Integration Guide', path: 'INTEGRATION_GUIDE.md' },
    { name: 'Deployment Guide', path: 'DEPLOYMENT.md' },
    { name: 'Examples README', path: 'src/examples/README.md' },
    { name: 'Art Examples', path: 'src/examples/ART_EXAMPLES.md' },
  ];
}

