export interface Member {
  id?: string;
  ign: string;
  job: string;
  dateJoined: string;
  uid?: string;
}

export interface GuildEvent {
  id?: string;
  name: string;
  description?: string;
  instructions?: string;
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
  role: 'user' | 'admin' | 'superadmin' | 'member';
  createdAt: string;
  isPreAuthorized?: boolean;
  authUid?: string | null;
}

export interface Job {
  id?: string;
  name: string;
}

export interface GuildSettings {
  id?: string;
  name: string;
  subtitle: string;
  timezone: string;
  logoUrl?: string;
}
