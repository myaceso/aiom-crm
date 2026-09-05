export type Lang = "en" | "es" | "de";

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
