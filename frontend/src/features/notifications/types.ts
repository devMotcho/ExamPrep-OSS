export interface ContactMessageStatus {
  id: string;
  name: string;
  color: string;
  createdAt?: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  ipAddress: string | null;
  read: boolean;
  sentChannels: string;
  type: string;
  createdAt: string;
  status: ContactMessageStatus | null;
  replyMessage?: string | null;
}
