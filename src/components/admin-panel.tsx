import { useEffect, useMemo, useState } from "react";
import { Button, Field, areaClass, fieldClass } from "@/components/ui";
import type { Group, Major, StandardItem } from "@/lib/quotes/model";
import { composeSpec, emptySpec, parseSpec, type SpecParts } from "@/lib/quotes/spec";
import {
  claimAdmin,
  deleteGroup,
  deleteItem,
  deleteMajor,
  getAccount,
  getAdminCatalog,
  listBills,
  reviewBill,
  saveGroup,
  saveItem,
  saveMajor,
  savePaySettings,
} from "@/lib/saas/api";
import type { AccountView, BillRow } from "@/lib/saas/plans";

type Tab = "groups" | "majors" | "items" | "bills";

function errText(error: unknown) {
  return error instanceof Error ? error.message : "做唔到";
}

const emptyGroup = (): Group => ({ id: "", group_code: "", title: "", sort_order: 1, is_active: true });
const emptyMajor = (): Major => ({
  id: "",
  major_num: 1,
  title: "",
  group_code: "A",
  property_types: [],
  sort_order: 1,
  is_active: true,
});
const emptyItem = (majorNum: number): StandardItem => ({
  id: "",
  major_num: majorNum,
  code: "",
  description: "",
  spec: "",
  unit: "項",
  cost_price: 0,
  is_active: true,
  sort_order: 0,
});

export function AdminPanel() {
  const [account, setAccount] = useState<AccountView | null>(null);
  const [tab, setTab] = useState<Tab>("groups");
  const [groups, setGroups] = useState<Group[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [items, setItems] = useState<StandardItem[]>([]);
  const [group, setGroup] = useState<Group>(emptyGroup);
  const [major, setMajor] = useState<Major>(emptyMajor);
  const [item, setItem] = useState<StandardItem>(emptyItem(1));
  const [specParts, setSpecParts] = useState<SpecParts>(emptySpec());
  const [query, setQuery] = useState("");
  const [filterMajor, setFilterMajor] = useState(0);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [fpsId, setFpsId] = useState("");
  const [payNote, setPayNote] = useState("");
  const [note, setNote] = useState("");

  function pickItem(row: StandardItem) {
    setItem(row);
    setSpecParts(parseSpec(row.spec));
  }

  function writeSpec(next: SpecParts) {
    setSpecParts(next);
    setItem((current) => ({ ...current, spec: composeSpec(next) }));
  }

  async function reload() {
    const catalog = await getAdminCatalog();
    setGroups(catalog.groups);
    setMajors(catalog.majors);
    setItems(catalog.items);
  }

  useEffect(() => {
    void getAccount()
      .then((next) => {
        setAccount(next);
        setFpsId(next.fpsId);
        setPayNote(next.payNote);
        if (next.isAdmin) return reload();
      })
      .catch((error: unknown) => setNote(errText(error)));
  }, []);

  useEffect(() => {
    if (tab !== "bills" || !account?.isAdmin) return;
    void listBills().then(setBills).catch((error: unknown) => setNote(errText(error)));
  }, [tab, account?.isAdmin]);

  const shownItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((row) => {
      if (filterMajor && row.major_num !== filterMajor) return false;
      if (!q) return true;
      return `${row.code} ${row.description} ${row.spec}`.toLowerCase().includes(q);
    });
  }, [items, query, filterMajor]);

  if (!account) return <p className="text-sm text-muted">後台載入緊…</p>;

  if (!account.isAdmin) {
    return (
      <section className="rounded-2xl bg-sheet p-5 shadow-card">
        <h1 className="font-serif text-3xl">後台</h1>
        {account.adminCount === 0 ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-muted">未有管理員。第一個撳下面嘅人就係呢個報價系統嘅管理員。</p>
            <Button
              className="mt-4"
              onClick={() => {
                void claimAdmin()
                  .then((next) => {
                    setAccount(next);
                    return reload();
                  })
                  .catch((error: unknown) => setNote(errText(error)));
              }}
            >
              我做管理員
            </Button>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">你唔係管理員，改唔到目錄。</p>
        )}
        {note ? <p className="mt-3 text-sm">{note}</p> : null}
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-serif text-3xl">後台管理</h1>
        <p className="mt-1 text-sm text-muted">加減總項、大項、細項。細項規格會跟住報價單印出。用戶收費喺最後一欄確認。</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["groups", "總項"],
            ["majors", "大項"],
            ["items", "細項"],
            ["bills", "收費"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`h-11 rounded-lg px-4 text-sm ${tab === id ? "bg-ink text-sun" : "bg-sheet shadow-card"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {note ? <p className="text-sm text-muted">{note}</p> : null}

      {tab === "groups" ? (
        <section className="grid gap-4 md:grid-cols-[16rem_1fr]">
          <form
            className="rounded-2xl bg-sheet p-4 shadow-card"
            onSubmit={(event) => {
              event.preventDefault();
              void saveGroup({ data: group })
                .then(() => {
                  setGroup(emptyGroup());
                  setNote("總項已儲存");
                  return reload();
                })
                .catch((error: unknown) => setNote(errText(error)));
            }}
          >
            <Field label="代號">
              <input className={fieldClass} value={group.group_code} onChange={(event) => setGroup({ ...group, group_code: event.target.value })} />
            </Field>
            <Field label="名稱" className="mt-3">
              <input className={fieldClass} value={group.title} onChange={(event) => setGroup({ ...group, title: event.target.value })} />
            </Field>
            <Field label="次序" className="mt-3">
              <input className={fieldClass} type="number" value={group.sort_order} onChange={(event) => setGroup({ ...group, sort_order: Number(event.target.value) })} />
            </Field>
            <Button className="mt-4 w-full" type="submit">{group.id ? "更新總項" : "加總項"}</Button>
          </form>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-sheet shadow-card">
            {groups.map((row) => (
              <li key={row.id} className="flex items-center gap-2 px-4 py-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setGroup(row)}>
                  <span className="font-medium">{row.group_code}</span>
                  <span className="ml-2">{row.title}</span>
                </button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (!window.confirm(`刪除總項 ${row.group_code}？下面大項同細項一併刪。`)) return;
                    void deleteGroup({ data: row.group_code }).then(reload).catch((error: unknown) => setNote(errText(error)));
                  }}
                >
                  刪除
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "majors" ? (
        <section className="grid gap-4 md:grid-cols-[18rem_1fr]">
          <form
            className="rounded-2xl bg-sheet p-4 shadow-card"
            onSubmit={(event) => {
              event.preventDefault();
              void saveMajor({ data: major })
                .then(() => {
                  setNote("大項已儲存");
                  return reload();
                })
                .catch((error: unknown) => setNote(errText(error)));
            }}
          >
            <Field label="編號">
              <input className={fieldClass} type="number" value={major.major_num} onChange={(event) => setMajor({ ...major, major_num: Number(event.target.value) })} />
            </Field>
            <Field label="名稱" className="mt-3">
              <input className={fieldClass} value={major.title} onChange={(event) => setMajor({ ...major, title: event.target.value })} />
            </Field>
            <Field label="總項" className="mt-3">
              <select className={fieldClass} value={major.group_code} onChange={(event) => setMajor({ ...major, group_code: event.target.value })}>
                {groups.map((row) => (
                  <option key={row.group_code} value={row.group_code}>{row.group_code} {row.title}</option>
                ))}
              </select>
            </Field>
            <Button className="mt-4 w-full" type="submit">{major.id ? "更新大項" : "加大項"}</Button>
            <Button className="mt-2 w-full" variant="ghost" type="button" onClick={() => setMajor(emptyMajor())}>清空</Button>
          </form>
          <ul className="max-h-[70vh] divide-y divide-line overflow-auto rounded-2xl bg-sheet shadow-card">
            {majors.map((row) => (
              <li key={row.id} className="flex items-center gap-2 px-4 py-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setMajor(row)}>
                  <span className="text-xs text-muted">{row.group_code} · {row.major_num}</span>
                  <span className="mt-1 block">{row.title}</span>
                </button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (!window.confirm(`刪除大項 ${row.major_num}？下面細項一併刪。`)) return;
                    void deleteMajor({ data: row.major_num }).then(reload).catch((error: unknown) => setNote(errText(error)));
                  }}
                >
                  刪除
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "items" ? (
        <section className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <form
            className="rounded-2xl bg-sheet p-4 shadow-card"
            onSubmit={(event) => {
              event.preventDefault();
              void saveItem({ data: item })
                .then(() => {
                  setNote("細項已儲存");
                  setItem(emptyItem(item.major_num));
                  setSpecParts(emptySpec());
                  return reload();
                })
                .catch((error: unknown) => setNote(errText(error)));
            }}
          >
            <Field label="大項">
              <select className={fieldClass} value={item.major_num} onChange={(event) => setItem({ ...item, major_num: Number(event.target.value) })}>
                {majors.map((row) => (
                  <option key={row.major_num} value={row.major_num}>{row.major_num}. {row.title}</option>
                ))}
              </select>
            </Field>
            <Field label="編號" className="mt-3">
              <input className={fieldClass} value={item.code} onChange={(event) => setItem({ ...item, code: event.target.value })} />
            </Field>
            <Field label="名稱" className="mt-3">
              <input className={fieldClass} value={item.description} onChange={(event) => setItem({ ...item, description: event.target.value })} />
            </Field>
            <Field label="詳細規格" className="mt-3">
              <div className="grid gap-2">
                <input className={fieldClass} placeholder="物料" value={specParts.material} onChange={(event) => writeSpec({ ...specParts, material: event.target.value })} />
                <input className={fieldClass} placeholder="做法" value={specParts.method} onChange={(event) => writeSpec({ ...specParts, method: event.target.value })} />
                <input className={fieldClass} placeholder="尺寸" value={specParts.size} onChange={(event) => writeSpec({ ...specParts, size: event.target.value })} />
                <input className={fieldClass} placeholder="唔包" value={specParts.excludes} onChange={(event) => writeSpec({ ...specParts, excludes: event.target.value })} />
                <textarea className={areaClass} rows={3} placeholder="其他說明" value={specParts.note} onChange={(event) => writeSpec({ ...specParts, note: event.target.value })} />
              </div>
            </Field>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="單位">
                <input className={fieldClass} value={item.unit} onChange={(event) => setItem({ ...item, unit: event.target.value })} />
              </Field>
              <Field label="成本單價">
                <input className={fieldClass} type="number" value={item.cost_price} onChange={(event) => setItem({ ...item, cost_price: Number(event.target.value) })} />
              </Field>
            </div>
            <Button className="mt-4 w-full" type="submit">{item.id ? "更新細項" : "加細項"}</Button>
          </form>
          <div className="overflow-hidden rounded-2xl bg-sheet shadow-card">
            <div className="grid gap-2 border-b border-line p-3 sm:grid-cols-2">
              <input className={fieldClass} placeholder="搵編號或規格" value={query} onChange={(event) => setQuery(event.target.value)} />
              <select className={fieldClass} value={filterMajor} onChange={(event) => setFilterMajor(Number(event.target.value))}>
                <option value={0}>全部大項</option>
                {majors.map((row) => (
                  <option key={row.major_num} value={row.major_num}>{row.major_num}. {row.title}</option>
                ))}
              </select>
            </div>
            <ul className="max-h-[70vh] divide-y divide-line overflow-auto">
              {shownItems.map((row) => (
                <li key={row.id} className="flex items-start gap-2 px-4 py-3">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => pickItem(row)}>
                    <p className="text-xs text-muted">{row.code} · 大項 {row.major_num} · {row.unit} · ${row.cost_price}</p>
                    <p className="mt-1">{row.description}</p>
                    {row.spec ? <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted">{row.spec}</p> : <p className="mt-1 text-sm text-muted">未寫規格</p>}
                  </button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (!window.confirm(`刪除細項 ${row.code}？`)) return;
                      void deleteItem({ data: row.id }).then(reload).catch((error: unknown) => setNote(errText(error)));
                    }}
                  >
                    刪除
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {tab === "bills" ? (
        <section className="grid gap-4">
          <form
            className="rounded-2xl bg-sheet p-4 shadow-card"
            onSubmit={(event) => {
              event.preventDefault();
              void savePaySettings({ data: { fpsId, payNote } })
                .then(() => setNote("示例付款設定已儲存；本示例不會收款。"))
                .catch((error: unknown) => setNote(errText(error)));
            }}
          >
            <Field label="示例收款識別碼（不可填真實資料）">
              <input className={fieldClass} value={fpsId} onChange={(event) => setFpsId(event.target.value)} />
            </Field>
            <Field label="示例付款說明（不接駁付款渠道）" className="mt-3">
              <textarea className={areaClass} rows={3} value={payNote} onChange={(event) => setPayNote(event.target.value)} />
            </Field>
            <Button className="mt-3" type="submit">儲存示例設定</Button>
          </form>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-sheet shadow-card">
            {bills.length === 0 ? <li className="px-4 py-6 text-sm text-muted">未有收費申請。</li> : null}
            {bills.map((row) => (
              <li key={row.userId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{row.name} · {row.plan === "year" ? "年費" : "月費"} · {row.status}</p>
                  <p className="text-sm text-muted">{row.email} · {row.payerName} · {row.reference}{row.periodEnd ? ` · 到 ${row.periodEnd}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void reviewBill({ data: { userId: row.userId, decision: "active" } }).then(() => listBills().then(setBills))}>確認已收</Button>
                  <Button variant="ghost" onClick={() => void reviewBill({ data: { userId: row.userId, decision: "rejected" } }).then(() => listBills().then(setBills))}>拒絕</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
