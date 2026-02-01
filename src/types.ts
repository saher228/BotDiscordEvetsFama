export interface EventData {
  id: string;
  name: string;
  server?: string;
  participantLimit: number;
  color?: string;
  colorSetByUser?: boolean;
  group?: string;
  time: string;
  map?: string;
  location?: string;
  creatorId: string;
  mainRoster: string[];
  reserveList: string[];
  rejected: string[];
  status: 'active' | 'completed' | 'cancelled';
  completionType?: 'success' | 'failure' | 'complete';
  channelId: string;
  messageId?: string;
  createdAt: number;
  notified?: boolean;
}
