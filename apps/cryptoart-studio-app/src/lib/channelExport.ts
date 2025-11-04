export interface ChannelCastData {
  hash: string;
  text: string;
  timestamp: string;
  author: {
    fid: number;
    username: string;
    displayName: string;
    followerCount: number;
    powerBadge: boolean;
  };
  reactions: {
    likesCount: number;
    recastsCount: number;
  };
  replies: {
    count: number;
  };
  isReply: boolean;
  channel: {
    id: string;
    name: string;
  };
  hasLinks: boolean;
  hasImages: boolean;
  hasEmbeds: boolean;
}

export interface ChannelSearchResponse {
  channelId: string;
  activityStats: {
    totalCasts: number;
    originalCasts: number;
    replies: number;
    totalLikes: number;
    totalRecasts: number;
    totalReplies: number;
    uniqueAuthors: number;
    castsWithLinks: number;
    castsWithImages: number;
    castsWithEmbeds: number;
  };
  topActiveUsers: Array<{
    fid: number;
    username: string;
    displayName: string;
    followerCount: number;
    powerBadge: boolean;
    activity: {
      totalCasts: number;
      originalCasts: number;
      replies: number;
      totalLikes: number;
      totalRecasts: number;
      totalReplies: number;
    };
  }>;
  casts: ChannelCastData[];
  pagination: {
    next?: string;
    hasMore: boolean;
  };
}

export function exportChannelCastsToCSV(data: ChannelSearchResponse): string {
  const headers = [
    'Hash',
    'Text',
    'Timestamp',
    'Author FID',
    'Author Username',
    'Author Display Name',
    'Author Followers',
    'Author Power Badge',
    'Likes Count',
    'Recasts Count',
    'Replies Count',
    'Is Reply',
    'Channel ID',
    'Channel Name',
    'Has Links',
    'Has Images',
    'Has Embeds',
  ];

  const rows = data.casts.map(cast => [
    cast.hash,
    `"${cast.text.replace(/"/g, '""')}"`, // Escape quotes in text
    cast.timestamp,
    cast.author.fid,
    cast.author.username,
    cast.author.displayName,
    cast.author.followerCount,
    cast.author.powerBadge,
    cast.reactions.likesCount,
    cast.reactions.recastsCount,
    cast.replies.count,
    cast.isReply,
    cast.channel.id,
    cast.channel.name,
    cast.hasLinks,
    cast.hasImages,
    cast.hasEmbeds,
  ]);

  return [headers, ...rows]
    .map(row => row.join(','))
    .join('\n');
}

export function exportActivityStatsToCSV(data: ChannelSearchResponse): string {
  const headers = [
    'Metric',
    'Value',
  ];

  const rows = [
    ['Total Casts', data.activityStats.totalCasts],
    ['Original Casts', data.activityStats.originalCasts],
    ['Replies', data.activityStats.replies],
    ['Total Likes', data.activityStats.totalLikes],
    ['Total Recasts', data.activityStats.totalRecasts],
    ['Total Replies', data.activityStats.totalReplies],
    ['Unique Authors', data.activityStats.uniqueAuthors],
    ['Casts with Links', data.activityStats.castsWithLinks],
    ['Casts with Images', data.activityStats.castsWithImages],
    ['Casts with Embeds', data.activityStats.castsWithEmbeds],
  ];

  return [headers, ...rows]
    .map(row => row.join(','))
    .join('\n');
}

export function exportTopUsersToCSV(data: ChannelSearchResponse): string {
  const headers = [
    'FID',
    'Username',
    'Display Name',
    'Follower Count',
    'Power Badge',
    'Total Casts',
    'Original Casts',
    'Replies',
    'Total Likes',
    'Total Recasts',
    'Total Replies',
  ];

  const rows = data.topActiveUsers.map(user => [
    user.fid,
    user.username,
    user.displayName,
    user.followerCount,
    user.powerBadge,
    user.activity.totalCasts,
    user.activity.originalCasts,
    user.activity.replies,
    user.activity.totalLikes,
    user.activity.totalRecasts,
    user.activity.totalReplies,
  ]);

  return [headers, ...rows]
    .map(row => row.join(','))
    .join('\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
