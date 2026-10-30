import { createServerFn } from "@tanstack/react-start";
import { openMiddleware } from "@/lib/saas/gate";
import { getSql, type Sql } from "@/lib/db";
import type { Catalog, Coefficient, Group, Major, Quote, SpaceDef, StandardItem } from "@/lib/quotes/model";
import { PLANS, TRIAL_LIMIT, type AccountView, type BillRow, type PlanId } from "@/lib/saas/plans";

type GroupInput = { id?: string; group_code: string; title: string; sort_order: number; is_active: boolean };
type MajorInput = {
  id?: string;
  major_num: number;
  title: string;
  group_code: string;
  sort_order: number;
  is_active: boolean;
};
type ItemInput = {
  id?: string;
  major_num: number;
  code: string;
  description: string;
  spec?: string;
  unit: string;
  cost_price: number;
  sort_order: number;
  is_active: boolean;
};

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function flag(value: unknown) {
  return value === true || value === 1 || value === "t" || value === "true";
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray<T>(value: unknown): T[] {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? (value as T[]) : [];
}

async function ensureCatalog(sql: Sql) {
  const meta = await sql<{ seeded: boolean }>`select seeded from catalog_meta where id = 1`;
  if (meta[0]?.seeded) return;
  const { loadCatalog } = await import("@/lib/quotes/remote");
  const { catalog } = await loadCatalog();
  for (const row of catalog.groups) {
    await sql`insert into catalog_groups (id, group_code, title, sort_order, is_active)
      values (${row.id}, ${row.group_code}, ${row.title}, ${row.sort_order}, ${row.is_active})
      on conflict (id) do nothing`;
  }
  for (const row of catalog.majors) {
    await sql`insert into catalog_majors (id, major_num, title, group_code, property_types, sort_order, is_active)
      values (${row.id}, ${row.major_num}, ${row.title}, ${row.group_code}, ${JSON.stringify(row.property_types)}::jsonb, ${row.sort_order}, ${row.is_active})
      on conflict (id) do nothing`;
  }
  for (const row of catalog.spaces) {
    await sql`insert into catalog_spaces (id, space_code, title, is_repeatable, sort_order, is_active)
      values (${row.id}, ${row.space_code}, ${row.title}, ${row.is_repeatable}, ${row.sort_order}, ${row.is_active})
      on conflict (id) do nothing`;
  }
  for (const row of catalog.items) {
    await sql`insert into catalog_items (id, major_num, code, description, spec, unit, cost_price, is_active, sort_order)
      values (${row.id}, ${row.major_num}, ${row.code}, ${row.description}, ${""}, ${row.unit}, ${row.cost_price}, ${row.is_active}, ${row.sort_order})
      on conflict (id) do nothing`;
  }
  for (const row of catalog.coefficients) {
    await sql`insert into catalog_coefficients (id, property_type, name, coefficient, is_active)
      values (${row.id}, ${row.property_type}, ${row.name}, ${row.coefficient}, ${row.is_active})
      on conflict (id) do nothing`;
  }
  await sql`insert into catalog_meta (id, seeded) values (1, true) on conflict (id) do update set seeded = true`;
}

function mapGroup(row: Record<string, unknown>): Group {
  return {
    id: String(row.id),
    group_code: String(row.group_code),
    title: String(row.title),
    sort_order: num(row.sort_order),
    is_active: flag(row.is_active),
  };
}

function mapMajor(row: Record<string, unknown>): Major {
  return {
    id: String(row.id),
    major_num: num(row.major_num),
    title: String(row.title),
    group_code: String(row.group_code),
    property_types: asArray<string>(row.property_types).map(String),
    sort_order: num(row.sort_order),
    is_active: flag(row.is_active),
  };
}

function mapSpace(row: Record<string, unknown>): SpaceDef {
  return {
    id: String(row.id),
    space_code: String(row.space_code),
    title: String(row.title),
    is_repeatable: flag(row.is_repeatable),
    sort_order: num(row.sort_order),
    is_active: flag(row.is_active),
  };
}

function mapItem(row: Record<string, unknown>): StandardItem {
  return {
    id: String(row.id),
    major_num: num(row.major_num),
    code: String(row.code),
    description: String(row.description),
    spec: String(row.spec ?? ""),
    unit: String(row.unit),
    cost_price: num(row.cost_price),
    is_active: flag(row.is_active),
    sort_order: num(row.sort_order),
  };
}

function mapCoef(row: Record<string, unknown>): Coefficient {
  return {
    id: String(row.id),
    property_type: String(row.property_type),
    name: String(row.name),
    coefficient: num(row.coefficient),
    is_active: flag(row.is_active),
  };
}

async function readCatalog(sql: Sql, activeOnly: boolean): Promise<Catalog> {
  await ensureCatalog(sql);
  const where = activeOnly ? "where is_active = true" : "";
  const [groups, majors, spaces, items, coefficients] = await Promise.all([
    sql.query<Record<string, unknown>>(`select * from catalog_groups ${where} order by sort_order, group_code`),
    sql.query<Record<string, unknown>>(`select * from catalog_majors ${where} order by major_num`),
    sql.query<Record<string, unknown>>(`select * from catalog_spaces ${where} order by sort_order, space_code`),
    sql.query<Record<string, unknown>>(`select * from catalog_items ${where} order by major_num, sort_order, code`),
    sql.query<Record<string, unknown>>(`select * from catalog_coefficients ${where} order by property_type`),
  ]);
  return {
    groups: groups.map(mapGroup),
    majors: majors.map(mapMajor),
    spaces: spaces.map(mapSpace),
    items: items.map(mapItem),
    coefficients: coefficients.map(mapCoef),
  };
}

async function isAdmin(sql: Sql, userId: string) {
  const rows = await sql<{ user_id: string }>`select user_id from admins where user_id = ${userId}`;
  return rows.length > 0;
}

async function requireAdmin(sql: Sql, userId: string) {
  if (!(await isAdmin(sql, userId))) throw new Error("你唔係管理員");
}

async function quoteCount(sql: Sql, userId: string) {
  const rows = await sql<{ quotes: unknown }>`select quotes from quote_bundles where user_id = ${userId}`;
  return asArray<Quote>(rows[0]?.quotes).length;
}

async function readAccount(sql: Sql, userId: string): Promise<AccountView> {
  const [adminRows, countRows, subRows, settings] = await Promise.all([
    sql<{ n: number }>`select count(*)::int as n from admins`,
    sql<{ user_id: string }>`select user_id from admins where user_id = ${userId}`,
    sql<Record<string, unknown>>`select * from subscriptions where user_id = ${userId}`,
    sql<{ fps_id: string; pay_note: string }>`select fps_id, pay_note from camp_settings where id = 1`,
  ]);
  const sub = subRows[0];
  const used = await quoteCount(sql, userId);
  const status = (text(sub?.status) || "trial") as AccountView["status"];
  const rawPlan = (text(sub?.plan) || "trial") as AccountView["plan"];
  const periodEnd = sub?.period_end ? String(sub.period_end).slice(0, 10) : null;
  const today = new Date().toISOString().slice(0, 10);
  const paid =
    status === "active" &&
    (rawPlan === "month" || rawPlan === "year") &&
    (!periodEnd || periodEnd >= today);
  const limit = paid ? null : TRIAL_LIMIT;
  return {
    isAdmin: countRows.length > 0,
    adminCount: num(adminRows[0]?.n),
    plan: paid ? rawPlan : "trial",
    status: status === "pending" || status === "rejected" || status === "active" ? status : "trial",
    payerName: text(sub?.payer_name),
    reference: text(sub?.reference),
    periodEnd,
    used,
    limit,
    canCreate: limit === null || used < limit,
    fpsId: settings[0]?.fps_id ?? "",
    payNote: settings[0]?.pay_note ?? "",
  };
}

export const getCatalog = createServerFn({ method: "GET" })
  .middleware([openMiddleware])
  .handler(async () => {
    const sql = await getSql();
    return { catalog: await readCatalog(sql, true), source: "camp" as const };
  });

export const getAdminCatalog = createServerFn({ method: "GET" })
  .middleware([openMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    return readCatalog(sql, false);
  });

export const getAccount = createServerFn({ method: "GET" })
  .middleware([openMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return readAccount(sql, context.userId);
  });

export const assertCanCreate = createServerFn({ method: "POST" })
  .middleware([openMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const account = await readAccount(sql, context.userId);
    if (!account.canCreate) {
      return { ok: false as const, message: `示例試用最多 ${TRIAL_LIMIT} 張報價單；方案金額僅為虛構示例。` };
    }
    return { ok: true as const, message: "" };
  });

export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([openMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ n: number }>`select count(*)::int as n from admins`;
    if (num(rows[0]?.n) > 0) throw new Error("已經有管理員");
    await sql`insert into admins (user_id) values (${context.userId}) on conflict (user_id) do nothing`;
    return readAccount(sql, context.userId);
  });

export const saveGroup = createServerFn({ method: "POST" })
  .middleware([openMiddleware])
  .validator((input: GroupInput) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const code = text(data.group_code).toUpperCase();
    const title = text(data.title);
    if (!code || !title) throw new Error("總項代號同名稱都要填");
    const id = text(data.id) || crypto.randomUUID();
    await sql`insert into catalog_groups (id, group_code, title, sort_order, is_active)
      values (${id}, ${code}, ${title}, ${num(data.sort_order)}, ${Boolean(data.is_active)})
      on conflict (id) do update set group_code = ${code}, title = ${title}, sort_order = ${num(data.sort_order)}, is_active = ${Boolean(data.is_active)}`;
    return { id };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([openMiddleware])
  .validator((code: string) => code)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const majors = await sql<{ major_num: number }>`select major_num from catalog_majors where group_code = ${data}`;
    for (const major of majors) {
      await sql`delete from catalog_items where major_num = ${major.major_num}`;
    }
    await sql`delete from catalog_majors where group_code = ${data}`;
    await sql`delete from catalog_groups where group_code = ${data}`;
    return { ok: true };
  });

export const saveMajor = createServerFn({ method: "POST" })
  .middleware([openMiddleware])
  .validator((input: MajorInput) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const title = text(data.title);
    const group = text(data.group_code).toUpperCase();
    const majorNum = Math.round(num(data.major_num));
    if (!title || !group || majorNum <= 0) throw new Error("大項編號、名稱、所屬總項都要填");
    const id = text(data.id) || crypto.randomUUID();
    await sql`insert into catalog_majors (id, major_num, title, group_code, property_types, sort_order, is_active)
      values (${id}, ${majorNum}, ${title}, ${group}, '[]'::jsonb, ${num(data.sort_order) || majorNum}, ${Boolean(data.is_active)})
      on conflict (id) do update set major_num = ${majorNum}, title = ${title}, group_code = ${group}, sort_order = ${num(data.sort_order) || majorNum}, is_active = ${Boolean(data.is_active)}`;
    return { id };
  });

export const deleteMajor = createServerFn({ method: "POST" })
  .middleware([openMiddleware])
  .validator((majorNum: number) => majorNum)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    await sql`delete from catalog_items where major_num = ${data}`;
    await sql`delete from catalog_majors where major_num = ${data}`;
    return { ok: true };
  });

export const saveItem = createServerFn({ method: "POST" })
  .middleware([openMiddleware])
  .validator((input: ItemInput) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const description = text(data.description);
    const code = text(data.code);
    const unit = text(data.unit);
    const majorNum = Math.round(num(data.major_num));
    if (!description || !code || !unit || majorNum <= 0) throw new Error("細項編號、說明、單位、大項都要填");
    const id = text(data.id) || crypto.randomUUID();
    const spec = typeof data.spec === "string" ? data.spec.trim() : "";
    await sql`insert into catalog_items (id, major_num, code, description, spec, unit, cost_price, is_active, sort_order)
      values (${id}, ${majorNum}, ${code}, ${description}, ${spec}, ${unit}, ${num(data.cost_price)}, ${Boolean(data.is_active)}, ${num(data.sort_order)})
      on conflict (id) do update set
        major_num = ${majorNum}, code = ${code}, description = ${description}, spec = ${spec},
        unit = ${unit}, cost_price = ${num(data.cost_price)}, is_active = ${Boolean(data.is_active)}, sort_order = ${num(data.sort_order)}`;
    return { id };
  });

export const deleteItem = createServerFn({ method: "POST" })
  .middleware([openMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    await sql`delete from catalog_items where id = ${data}`;
    return { ok: true };
  });

export const savePaySettings = createServerFn({ method: "POST" })
  .middleware([openMiddleware])
  .validator((input: { fpsId: string; payNote: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    await sql`insert into camp_settings (id, fps_id, pay_note) values (1, ${text(data.fpsId)}, ${text(data.payNote)})
      on conflict (id) do update set fps_id = ${text(data.fpsId)}, pay_note = ${text(data.payNote)}`;
    return { ok: true };
  });

export const requestPlan = createServerFn({ method: "POST" })
  .middleware([openMiddleware])
  .validator((input: { plan: PlanId; payerName: string; reference: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const plan = PLANS.find((row) => row.id === data.plan);
    if (!plan) throw new Error("未有呢個計劃");
    const payer = text(data.payerName);
    const reference = text(data.reference);
    if (!payer || !reference) throw new Error("付款人同參考編號都要填");
    await sql`insert into subscriptions (user_id, plan, status, payer_name, reference, period_end, updated_at)
      values (${context.userId}, ${plan.id}, 'pending', ${payer}, ${reference}, null, now())
      on conflict (user_id) do update set
        plan = ${plan.id}, status = 'pending', payer_name = ${payer}, reference = ${reference}, updated_at = now()`;
    return readAccount(sql, context.userId);
  });

function periodEnd(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export const reviewBill = createServerFn({ method: "POST" })
  .middleware([openMiddleware])
  .validator((input: { userId: string; decision: "active" | "rejected" }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const rows = await sql<{ plan: string }>`select plan from subscriptions where user_id = ${data.userId}`;
    const plan = PLANS.find((row) => row.id === rows[0]?.plan);
    if (!rows[0] || !plan) throw new Error("搵唔到呢張申請");
    const end = data.decision === "active" ? periodEnd(plan.days) : null;
    await sql`update subscriptions set status = ${data.decision}, period_end = ${end}, updated_at = now() where user_id = ${data.userId}`;
    return { ok: true };
  });

export const listBills = createServerFn({ method: "GET" })
  .middleware([openMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const rows = await sql<Record<string, unknown>>`
      select s.user_id, s.plan, s.status, s.payer_name, s.reference, s.period_end,
             u.name as user_name, u.email as user_email
      from subscriptions s
      left join "user" u on u.id = s.user_id
      order by s.updated_at desc`;
    return rows.map((row): BillRow => ({
      userId: String(row.user_id),
      name: text(row.user_name) || "未有名稱",
      email: text(row.user_email),
      plan: text(row.plan),
      status: text(row.status),
      payerName: text(row.payer_name),
      reference: text(row.reference),
      periodEnd: row.period_end ? String(row.period_end) : null,
    }));
  });

export const loadMyQuotes = createServerFn({ method: "GET" })
  .middleware([openMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ seq: number; quotes: unknown }>`select seq, quotes from quote_bundles where user_id = ${context.userId}`;
    return { seq: num(rows[0]?.seq), quotes: asArray<Quote>(rows[0]?.quotes) };
  });

export const saveMyQuotes = createServerFn({ method: "POST" })
  .middleware([openMiddleware])
  .validator((input: { seq: number; quotes: Quote[] }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const account = await readAccount(sql, context.userId);
    const quotes = Array.isArray(data.quotes) ? data.quotes : [];
    if (account.limit !== null && quotes.length > account.limit) {
      throw new Error(`示例試用最多 ${account.limit} 張報價單`);
    }
    await sql`insert into quote_bundles (user_id, seq, quotes, updated_at)
      values (${context.userId}, ${num(data.seq)}, ${JSON.stringify(quotes)}::jsonb, now())
      on conflict (user_id) do update set seq = ${num(data.seq)}, quotes = ${JSON.stringify(quotes)}::jsonb, updated_at = now()`;
    return { ok: true };
  });
