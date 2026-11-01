export interface UserActivity {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  phone?: string | null;
  isActive?: boolean;
  active?: boolean;
  lastLoginAt?: string | null;
  updatedAt?: string | null;
}

export interface MessageActivity {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  statusName?: string | null;
  statusColor?: string | null;
  statusId?: string | null;
  sentChannels?: string;
  type?: string;
  ipAddress?: string | null;
  replyMessage?: string | null;
}

export interface TrendPoint {
  name: string;
  value: number;
}

export interface DashboardStats {
  totalUsers: number;
  newUsers7Days: number;
  newUsers30Days: number;
  newUsers7DaysGrowth: number;
  newUsers30DaysGrowth: number;
  activeUsers: number;
  totalMessages: number;
  unreadMessages: number;
  usersGrowthPercentage: number;
  messagesGrowthPercentage: number;
  totalQueries: number;
  emailChannelActive: boolean;
  registrationOpen: boolean;
  adminCount: number;
  totalDevices: number;
  authenticatedDevices: number;
  visitorDevices: number;
  registrationTrend: TrendPoint[];
  messagesTrend: TrendPoint[];
  queriesTrend: TrendPoint[];
  recentUsers: UserActivity[];
  recentMessages: MessageActivity[];
}

export interface ChartProps {
  data: TrendPoint[];
  label: string;
  hoveredIndex: number | null;
  setHoveredIndex: (idx: number | null) => void;
  accentClass?: string;
  gradientId: string;
}
