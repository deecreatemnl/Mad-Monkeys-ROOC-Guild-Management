export interface Member {
  id?: string;
  ign: string;
  job: string;
  role?: string;
  dateJoined: string;
  uid?: string;
  discordId?: string;
  status?: 'active' | 'inactive' | 'busy' | 'left';
}

export interface MemberLog {
  id?: string;
  memberId: string;
  type: 'status_change' | 'name_change' | 'job_change' | 'role_change' | 'guild_join' | 'guild_leave' | 'guild_return';
  oldValue?: string;
  newValue?: string;
  timestamp: string;
  details?: string;
}

export interface Absence {
  memberId: string;
  ign: string;
  reason: string;
  dates?: string[];
  timestamp: string;
}

export interface GuildEvent {
  id?: string;
  name: string;
  description?: string;
  instructions?: string;
  absences?: Absence[];
  schedule?: number[]; // 0-6 for Sunday-Saturday
}

export interface SubEvent {
  id?: string;
  eventId: string;
  name: string;
  order: number;
}

export interface Party {
  id?: string;
  eventId: string;
  subEventId: string;
  name: string;
  order: number;
  maxSize?: number;
}

export interface Assignment {
  id?: string;
  eventId: string;
  subEventId: string;
  partyId: string;
  memberId: string;
  role: string;
  order: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  displayName: string;
  ign?: string;
  uid?: string;
  isApproved?: boolean;
  role: 'user' | 'admin' | 'superadmin' | 'member';
  createdAt: string;
  isPreAuthorized?: boolean;
  authUid?: string | null;
  discordId?: string;
}

export interface Job {
  id?: string;
  name: string;
  color?: string;
}

export interface GuildSettings {
  id?: string;
  name: string;
  subtitle: string;
  timezone: string;
  logoUrl?: string;
  maxPartySize?: number;
  discordChannelId?: string; // Legacy field
  discordGuildId?: string;
  discordAnnouncementsChannelId?: string;
  discordAbsenceChannelId?: string;
  discordWebhookUrl?: string;
  githubRepo?: string;
  vercelDeployHookUrl?: string;
  raffleWinners?: number;
}
