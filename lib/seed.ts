import type {
  Contact,
  Opportunity,
  Conversation,
  Appointment,
  Activity,
  Settings,
} from "./types";

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
          body: `Hi ${c.firstName}, thanks for reaching out to All In One Marketing!`,
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
  companyName: "All In One Marketing",
  primaryColor: "#38a0db",
  language: "de",
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
