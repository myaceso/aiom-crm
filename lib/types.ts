export type Lang = "en" | "es";

export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  tags: string[];
  source: string;
  status: "active" | "lead" | "inactive";
  notes: Note[];
  timeline: TimelineEvent[];
  createdAt: string;
};

export type Note = {
  id: string;
  body: string;
  createdAt: string;
  author: string;
};

export type TimelineEvent = {
  id: string;
  type: "email" | "call" | "sms" | "note" | "deal" | "appointment";
  title: string;
  createdAt: string;
};

export type Stage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

export type Opportunity = {
  id: string;
  title: string;
  contactId: string;
  contactName: string;
  value: number;
  stage: Stage;
  probability: number;
  owner: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  contactId: string;
  contactName: string;
  channel: "sms" | "email" | "facebook" | "whatsapp";
  unread: number;
  lastMessage: string;
  updatedAt: string;
  messages: Message[];
};

export type Message = {
  id: string;
  body: string;
  fromMe: boolean;
  createdAt: string;
};

export type Appointment = {
  id: string;
  title: string;
  contactName: string;
  start: string;
  end: string;
  calendar: string;
  status: "confirmed" | "pending" | "cancelled";
};

export type Activity = {
  id: string;
  text: string;
  time: string;
  type: string;
};

export type Settings = {
  companyName: string;
  primaryColor: string;
  language: Lang;
};

export type SocialNetworkId =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "x"
  | "tiktok"
  | "google_business";

export type SocialConnection = {
  id: SocialNetworkId;
  name: string;
  connected: boolean;
  handle?: string;
  profileUrl?: string;
  accessToken?: string;
};

export type SocialPostStatus = "draft" | "scheduled" | "published";

export type MediaKind = "image" | "video";

export type MediaAsset = {
  id: string;
  kind: MediaKind;
  name: string;
  size: number;
  mime: string;
  createdAt: string;
  /** Session-only object URL; never persisted to localStorage */
  previewUrl?: string;
  durationSec?: number;
};

export type SocialMediaMeta = {
  id: string;
  kind: MediaKind;
  name: string;
  size: number;
  mime: string;
};

export type SocialPost = {
  id: string;
  body: string;
  channels: SocialNetworkId[];
  status: SocialPostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  mediaIds: string[];
};

export type SmsCampaignStatus = "draft" | "scheduled" | "sent";

export type SmsCampaign = {
  id: string;
  name: string;
  body: string;
  audience: string;
  status: SmsCampaignStatus;
  sent: number;
  delivered: number;
  clicked: number;
  createdAt: string;
  scheduledAt: string | null;
};

export type EmailCampaignStatus = "draft" | "scheduled" | "sent";

export type EmailCampaign = {
  id: string;
  name: string;
  subject: string;
  body: string;
  audience: string;
  templateId?: string;
  status: EmailCampaignStatus;
  sent: number;
  opened: number;
  clicked: number;
  createdAt: string;
  scheduledAt: string | null;
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

export type SmsIntegration = {
  connected: boolean;
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

export type EmailProvider = "resend" | "sendgrid";

export type EmailIntegration = {
  connected: boolean;
  provider: EmailProvider;
  apiKey: string;
  fromEmail: string;
  fromName: string;
};

export type Integrations = {
  sms: SmsIntegration;
  email: EmailIntegration;
};
