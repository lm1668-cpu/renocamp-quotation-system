export const PLANS = [
  {
    id: "month" as const,
    name: "示例月費",
    price: 11,
    days: 31,
    blurb: "虛構示例價格；此示例不會收款。",
  },
  {
    id: "year" as const,
    name: "示例年費",
    price: 111,
    days: 366,
    blurb: "虛構示例價格；此示例不會收款。",
  },
];

export const TRIAL_LIMIT = 1;

export type PlanId = (typeof PLANS)[number]["id"];

export type AccountView = {
  isAdmin: boolean;
  adminCount: number;
  plan: "trial" | PlanId;
  status: "trial" | "pending" | "active" | "rejected";
  payerName: string;
  reference: string;
  periodEnd: string | null;
  used: number;
  limit: number | null;
  canCreate: boolean;
  fpsId: string;
  payNote: string;
};

export type BillRow = {
  userId: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  payerName: string;
  reference: string;
  periodEnd: string | null;
};
