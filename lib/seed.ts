import type {
  Contact,
  Opportunity,
  Conversation,
  Appointment,
  Activity,
  Settings,
  SocialConnection,
  SocialPost,
  SmsCampaign,
  EmailCampaign,
  EmailTemplate,
  Integrations,
} from "./types";
import { blankBufferIntegration } from "./buffer/model";

const now = Date.now();
const daysAgo = (d: number, h = 10) =>
  new Date(now - d * 86400000 - h * 3600000).toISOString();

const firstNames = [
  "Jordan", "Ava", "Marcus", "Sofia", "Liam", "Maya", "Noah", "Elena",
  "Ethan", "Priya", "Lucas", "Isabella", "Owen", "Chloe", "Caleb",
  "Amelia", "Ryan", "Natalie", "Diego", "Hannah", "Kevin", "Grace",
];
const lastNames = [
  "Chen", "Patel", "Rivera", "Nguyen", "Brooks", "Santos", "Kim",
  "Walsh", "Torres", "Singh", "Morgan", "Ali", "Foster", "Ramirez",
  "Hayes", "Lopez", "Clark", "Diaz", "Reed", "Bennett", "Price", "Young",
];
const companies = [
  "BrightPath Agency", "Summit Dental", "Harbor Fitness", "Nexa Solar",
  "Bluebird Realty", "Cascade Auto", "Vista Legal", "Pulse Media",
  "Oak & Pine Interiors", "CloudNine SaaS", "GreenLeaf Organics",
  "Metro Plumbing Co", "Apex Coaching", "Lumen Studios", "Tidewater Insurance",
];
const tagPool = ["VIP", "Hot Lead", "Newsletter", "Webinar", "SMS Opt-in", "Referral", "Local", "Enterprise"];
const sources = ["Facebook Ads", "Google Ads", "Organic", "Referral", "Walk-in", "Chat Widget"];

export function createSeedContacts(): Contact[] {
  return firstNames.map((fn, i) => {
    const ln = lastNames[i];
    const id = `c${i + 1}`;
    return {
      id,
      firstName: fn,
      lastName: ln,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com`,
      phone: `+1 (555) ${String(100 + i).padStart(3, "0")}-${String(1000 + i * 17).slice(-4)}`,
      company: companies[i % companies.length],
      tags: [tagPool[i % tagPool.length], tagPool[(i + 3) % tagPool.length]].filter(
        (v, idx, a) => a.indexOf(v) === idx
      ),
      source: sources[i % sources.length],
      status: (["active", "lead", "inactive"] as const)[i % 3],
      notes: [
        {
          id: `n${id}-1`,
          body: `Initial discovery call with ${fn}. Interested in full marketing stack.`,
          createdAt: daysAgo(14 - (i % 10)),
          author: "Demo User",
        },
      ],
      timeline: [
        {
          id: `t${id}-1`,
          type: "email",
          title: "Welcome email opened",
          createdAt: daysAgo(12 - (i % 8)),
        },
        {
          id: `t${id}-2`,
          type: "call",
          title: "Outbound call — 4 min",
          createdAt: daysAgo(7 - (i % 5)),
        },
        {
          id: `t${id}-3`,
          type: "sms",
          title: "SMS reply received",
          createdAt: daysAgo(3 - (i % 3)),
        },
      ],
      createdAt: daysAgo(30 - i),
    };
  });
}

export function createSeedOpportunities(contacts: Contact[]): Opportunity[] {
  const stages = ["new", "contacted", "qualified", "proposal", "won", "lost"] as const;
  const titles = [
    "Website Redesign Package",
    "Monthly Marketing Retainer",
    "CRM Onboarding",
    "Facebook Ads Campaign",
    "SEO Growth Plan",
    "Funnel Build + Email",
    "Reputation Management",
    "SMS Automation Suite",
    "Calendar Booking Setup",
    "Full Agency Bundle",
    "Local SEO Sprint",
    "Lead Gen Landing Pages",
  ];
  return titles.map((title, i) => {
    const c = contacts[i % contacts.length];
    return {
      id: `o${i + 1}`,
      title,
      contactId: c.id,
      contactName: `${c.firstName} ${c.lastName}`,
      value: [2500, 4500, 1200, 8000, 3200, 5600, 1800, 9900, 2100, 15000, 2800, 6400][i],
      stage: stages[i % stages.length],
      probability: [10, 25, 40, 60, 100, 0][i % 6],
      owner: "Demo User",
      createdAt: daysAgo(20 - i),
    };
  });
}

export function createSeedConversations(contacts: Contact[]): Conversation[] {
  const channels = ["sms", "email", "facebook", "whatsapp"] as const;
  return contacts.slice(0, 12).map((c, i) => {
    const updatedAt = daysAgo(i % 5, i);
    return {
      id: `conv${i + 1}`,
      contactId: c.id,
      contactName: `${c.firstName} ${c.lastName}`,
      channel: channels[i % channels.length],
      unread: i % 3 === 0 ? (i % 4) + 1 : 0,
      lastMessage:
        i % 2 === 0
          ? "Thanks! Can we schedule a call this week?"
          : "Just sent over the proposal — let me know what you think.",
      updatedAt,
      messages: [
        {
          id: `m${i}-1`,
          body: `Hi ${c.firstName}, thanks for reaching out to enone!`,
          fromMe: true,
          createdAt: daysAgo(i % 5 + 1, 2),
        },
        {
          id: `m${i}-2`,
          body: "Hey! I'd love to learn more about your CRM and automations.",
          fromMe: false,
          createdAt: daysAgo(i % 5, 5),
        },
        {
          id: `m${i}-3`,
          body:
            i % 2 === 0
              ? "Thanks! Can we schedule a call this week?"
              : "Just sent over the proposal — let me know what you think.",
          fromMe: i % 2 !== 0,
          createdAt: updatedAt,
        },
      ],
    };
  });
}

export function createSeedAppointments(): Appointment[] {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const dayOffset = (d: number, hour: number, mins = 0) => {
    const x = new Date(base);
    x.setDate(x.getDate() - x.getDay() + d);
    x.setHours(hour, mins, 0, 0);
    return x.toISOString();
  };
  return [
    {
      id: "a1",
      title: "Discovery Call — Summit Dental",
      contactName: "Ava Patel",
      start: dayOffset(1, 10),
      end: dayOffset(1, 10, 30),
      calendar: "Sales",
      status: "confirmed",
    },
    {
      id: "a2",
      title: "Demo — CloudNine SaaS",
      contactName: "Marcus Rivera",
      start: dayOffset(2, 14),
      end: dayOffset(2, 15),
      calendar: "Sales",
      status: "confirmed",
    },
    {
      id: "a3",
      title: "Onboarding Kickoff",
      contactName: "Sofia Nguyen",
      start: dayOffset(3, 11),
      end: dayOffset(3, 12),
      calendar: "Success",
      status: "pending",
    },
    {
      id: "a4",
      title: "Strategy Review",
      contactName: "Liam Brooks",
      start: dayOffset(4, 9, 30),
      end: dayOffset(4, 10, 30),
      calendar: "Sales",
      status: "confirmed",
    },
    {
      id: "a5",
      title: "Ads Performance Sync",
      contactName: "Maya Santos",
      start: dayOffset(5, 15),
      end: dayOffset(5, 15, 45),
      calendar: "Marketing",
      status: "confirmed",
    },
    {
      id: "a6",
      title: "Proposal Walkthrough",
      contactName: "Noah Kim",
      start: dayOffset(3, 16),
      end: dayOffset(3, 16, 45),
      calendar: "Sales",
      status: "pending",
    },
  ];
}

export function createSeedActivity(): Activity[] {
  return [
    { id: "act1", text: "Jordan Chen opened the proposal email", time: "12 min ago", type: "email" },
    { id: "act2", text: "New lead from Facebook Ads — Elena Walsh", time: "34 min ago", type: "lead" },
    { id: "act3", text: "Deal moved to Proposal: SEO Growth Plan", time: "1 hr ago", type: "deal" },
    { id: "act4", text: "SMS replied by Priya Torres", time: "2 hr ago", type: "sms" },
    { id: "act5", text: "Appointment booked with Diego Reed", time: "3 hr ago", type: "calendar" },
    { id: "act6", text: "Payment received — $4,500 from Harbor Fitness", time: "5 hr ago", type: "payment" },
    { id: "act7", text: "Workflow enrolled: Welcome Series", time: "Yesterday", type: "automation" },
    { id: "act8", text: "5-star Google review from Vista Legal", time: "Yesterday", type: "reputation" },
  ];
}

export const defaultSettings: Settings = {
  companyName: "enone",
  primaryColor: "#6366f1",
  language: "es",
};

export const pipelineChartData = [
  { name: "New", value: 18 },
  { name: "Contacted", value: 12 },
  { name: "Qualified", value: 9 },
  { name: "Proposal", value: 6 },
  { name: "Won", value: 4 },
  { name: "Lost", value: 3 },
];

export const leadSourceChartData = [
  { name: "Facebook", value: 34 },
  { name: "Google", value: 28 },
  { name: "Organic", value: 18 },
  { name: "Referral", value: 12 },
  { name: "Other", value: 8 },
];

export const revenueTrendData = [
  { month: "Apr", revenue: 42000, leads: 86 },
  { month: "May", revenue: 48000, leads: 102 },
  { month: "Jun", revenue: 51000, leads: 110 },
  { month: "Jul", revenue: 47000, leads: 95 },
  { month: "Aug", revenue: 59000, leads: 128 },
  { month: "Sep", revenue: 63000, leads: 141 },
];

export function createSeedSocialConnections(): SocialConnection[] {
  return [
    { id: "facebook", name: "Facebook", connected: false, handle: "", profileUrl: "", accessToken: "", pageId: "" },
    { id: "instagram", name: "Instagram", connected: false, handle: "", profileUrl: "", accessToken: "", pageId: "" },
    { id: "linkedin", name: "LinkedIn", connected: false, handle: "", profileUrl: "", accessToken: "", pageId: "" },
    { id: "x", name: "X", connected: false, handle: "", profileUrl: "", accessToken: "", pageId: "" },
    { id: "tiktok", name: "TikTok", connected: false, handle: "", profileUrl: "", accessToken: "", pageId: "" },
    { id: "google_business", name: "Google Business", connected: false, handle: "", profileUrl: "", accessToken: "", pageId: "" },
  ];
}

export const defaultIntegrations: Integrations = {
  sms: {
    connected: false,
    accountSid: "",
    authToken: "",
    fromNumber: "",
  },
  email: {
    connected: false,
    provider: "resend",
    apiKey: "",
    fromEmail: "",
    fromName: "",
  },
  whatsapp: {
    connected: false,
    phoneNumberId: "",
    accessToken: "",
    wabaId: "",
  },
  telegram: {
    connected: false,
    botToken: "",
    defaultChatId: "",
  },
  buffer: blankBufferIntegration(),
};

export function createSeedSocialPosts(): SocialPost[] {
  return [
    {
      id: "sp1",
      body: "🚀 New CRM features are live — SMS, email & social scheduling in one place. Book a demo today!",
      channels: ["facebook", "instagram", "linkedin"],
      status: "published",
      scheduledAt: null,
      publishedAt: daysAgo(2, 9),
      createdAt: daysAgo(3),
      mediaIds: [],
    },
    {
      id: "sp2",
      body: "Fall promo: 20% off marketing retainers for local businesses. Limited spots — DM us!",
      channels: ["instagram", "x"],
      status: "scheduled",
      scheduledAt: new Date(now + 2 * 86400000).toISOString(),
      publishedAt: null,
      createdAt: daysAgo(1),
      mediaIds: [],
    },
    {
      id: "sp3",
      body: "Behind the scenes at enone HQ 🎬 All in one CRM so you can grow faster.",
      channels: ["tiktok", "instagram"],
      status: "scheduled",
      scheduledAt: new Date(now + 5 * 86400000).toISOString(),
      publishedAt: null,
      createdAt: daysAgo(0, 2),
      mediaIds: [],
    },
    {
      id: "sp4",
      body: "5-star week! Thanks to our clients for the amazing Google reviews ⭐⭐⭐⭐⭐",
      channels: ["google_business", "facebook"],
      status: "published",
      scheduledAt: null,
      publishedAt: daysAgo(5, 14),
      createdAt: daysAgo(6),
      mediaIds: [],
    },
    {
      id: "sp5",
      body: "Draft: Webinar invite — Mastering lead nurturing in 2026.",
      channels: ["linkedin", "x"],
      status: "draft",
      scheduledAt: null,
      publishedAt: null,
      createdAt: daysAgo(0, 1),
      mediaIds: [],
    },
  ];
}

export function createSeedSmsCampaigns(): SmsCampaign[] {
  return [
    {
      id: "sms1",
      name: "Fall Promo SMS",
      body: "Hi {{first_name}}! Fall promo: 20% off this month. Reply YES to claim. Msg&data rates may apply. STOP to opt out.",
      audience: "SMS Opt-in",
      status: "sent",
      sent: 8910,
      delivered: 8724,
      clicked: 1942,
      createdAt: daysAgo(10),
      scheduledAt: null,
    },
    {
      id: "sms2",
      name: "Review Request",
      body: "Thanks for choosing us! Leave a quick Google review: {{review_link}} — we appreciate you 💙",
      audience: "Active Customers",
      status: "sent",
      sent: 3104,
      delivered: 3051,
      clicked: 1272,
      createdAt: daysAgo(7),
      scheduledAt: null,
    },
    {
      id: "sms3",
      name: "Appointment Reminder",
      body: "Reminder: your appointment is tomorrow at {{time}}. Reply C to confirm or R to reschedule.",
      audience: "Upcoming Appointments",
      status: "scheduled",
      sent: 0,
      delivered: 0,
      clicked: 0,
      createdAt: daysAgo(1),
      scheduledAt: new Date(now + 1 * 86400000).toISOString(),
    },
    {
      id: "sms4",
      name: "Webinar Flash Invite",
      body: "Last chance! Free webinar tonight 7pm. Join: {{link}}",
      audience: "Newsletter",
      status: "draft",
      sent: 0,
      delivered: 0,
      clicked: 0,
      createdAt: daysAgo(0, 3),
      scheduledAt: null,
    },
  ];
}

export function createSeedEmailTemplates(): EmailTemplate[] {
  return [
    {
      id: "et1",
      name: "Welcome Series — Day 1",
      subject: "Welcome to {{company}} 👋",
      body: "Hi {{first_name}},\n\nThanks for joining us! Here's how to get started with your CRM in under 10 minutes...\n\nBest,\nThe enone Team",
    },
    {
      id: "et2",
      name: "Promo — Seasonal Offer",
      subject: "Your exclusive fall offer inside",
      body: "Hi {{first_name}},\n\nFor a limited time, enjoy 20% off any marketing retainer. Use code FALL20 at checkout.\n\nCheers!",
    },
    {
      id: "et3",
      name: "Nurture — Case Study",
      subject: "How Harbor Fitness grew 3× with enone",
      body: "Hi {{first_name}},\n\nMeet Harbor Fitness — they automated follow-ups and booked 40% more appointments in 90 days.\n\nRead the full story →",
    },
    {
      id: "et4",
      name: "Re-engagement",
      subject: "We miss you — here's 15% off",
      body: "Hi {{first_name}},\n\nIt's been a while! Come back and unlock 15% off your next invoice with code MISSYOU.\n\nSee you soon!",
    },
  ];
}

export function createSeedEmailCampaigns(): EmailCampaign[] {
  return [
    {
      id: "em1",
      name: "Welcome Series",
      subject: "Welcome to enone 👋",
      body: "Hi {{first_name}},\n\nThanks for joining us! Here's how to get started...",
      audience: "New Leads (30d)",
      templateId: "et1",
      status: "sent",
      sent: 12482,
      opened: 4268,
      clicked: 1284,
      createdAt: daysAgo(14),
      scheduledAt: null,
    },
    {
      id: "em2",
      name: "Webinar Invite",
      subject: "Join our free webinar: Lead nurturing in 2026",
      body: "Hi {{first_name}},\n\nSave your seat for Thursday's live session...",
      audience: "Newsletter",
      templateId: "et3",
      status: "scheduled",
      sent: 0,
      opened: 0,
      clicked: 0,
      createdAt: daysAgo(2),
      scheduledAt: new Date(now + 3 * 86400000).toISOString(),
    },
    {
      id: "em3",
      name: "New Lead Nurture",
      subject: "3 ways to close more deals this month",
      body: "Hi {{first_name}},\n\nHere are three proven plays our top clients use...",
      audience: "Hot Leads",
      templateId: "et3",
      status: "sent",
      sent: 6771,
      opened: 1929,
      clicked: 612,
      createdAt: daysAgo(8),
      scheduledAt: null,
    },
    {
      id: "em4",
      name: "Fall Promo Blast",
      subject: "Your exclusive fall offer inside",
      body: "Hi {{first_name}},\n\nFor a limited time, enjoy 20% off...",
      audience: "All Contacts",
      templateId: "et2",
      status: "draft",
      sent: 0,
      opened: 0,
      clicked: 0,
      createdAt: daysAgo(0, 4),
      scheduledAt: null,
    },
  ];
}
