import { redirect } from 'next/navigation';

/**
 * Admin dashboard root page.
 * Redirects to the Featured tab by default.
 */
export default function AdminPage() {
  redirect('/admin/featured');
}

