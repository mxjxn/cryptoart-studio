/**
 * CSV Export Utility for Mini-Apps
 * 
 * Provides functionality to convert data arrays to CSV format and copy to clipboard.
 * Used for exporting subscriber data from Hypersub contracts in mini-app environments.
 */

export interface SubscriberData {
  fid: number;
  username: string;
  displayName?: string;
  walletAddress?: string;
  subscriptionDate?: string;
  isActive?: boolean;
}

/**
 * Converts an array of subscriber data to CSV format
 * @param data Array of subscriber objects
 * @returns CSV formatted string
 */
export function convertSubscribersToCSV(data: SubscriberData[]): string {
  if (!data || data.length === 0) {
    return '';
  }

  // Define CSV headers
  const headers = ['FID', 'Username', 'Display Name', 'Wallet Address', 'Subscription Date', 'Active'];
  
  // Convert data to CSV rows
  const csvRows = [
    headers.join(','),
    ...data.map(subscriber => [
      subscriber.fid,
      `"${subscriber.username || ''}"`,
      `"${subscriber.displayName || ''}"`,
      `"${subscriber.walletAddress || ''}"`,
      `"${subscriber.subscriptionDate || ''}"`,
      subscriber.isActive ? 'Yes' : 'No'
    ].join(','))
  ];

  return csvRows.join('\n');
}

/**
 * Copies CSV content to clipboard
 * @param csvContent CSV formatted string
 * @returns Promise that resolves when copy is complete
 */
export async function copyCSVToClipboard(csvContent: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(csvContent);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    throw new Error('Failed to copy to clipboard. Please try again.');
  }
}

/**
 * Formats a date string for CSV export
 * @param dateString ISO date string or Date object
 * @returns Formatted date string
 */
export function formatDateForCSV(dateString: string | Date): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
