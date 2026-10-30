import { useEffect, useState } from "react";
import { Button, Field, fieldClass } from "@/components/ui";
import { getAccount, requestPlan } from "@/lib/saas/api";
import { PLANS, type AccountView, type PlanId } from "@/lib/saas/plans";

function errText(error: unknown) {
  return error instanceof Error ? error.message : "做唔到";
}

export function PlanPanel() {
  const [account, setAccount] = useState<AccountView | null>(null);
  const [plan, setPlan] = useState<PlanId>("month");
  const [payerName, setPayerName] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    void getAccount().then(setAccount).catch((error: unknown) => setNote(errText(error)));
  }, []);

  if (!account) return <p className="text-sm text-muted">收費資料載入緊…</p>;

  const status =
    account.status === "active"
      ? `示例方案已啟用，期限 ${account.periodEnd ?? "—"}`
      : account.status === "pending"
        ? "示例申請已提交；本示例不會處理付款。"
        : account.status === "rejected"
          ? "上一份示例申請未確認。"
          : `示例試用中，已用 ${account.used}／${account.limit ?? 1} 張。`;

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl bg-sheet p-5 shadow-card">
        <p className="text-xs tracking-widest text-sea">你而家</p>
        <h1 className="mt-1 font-serif text-3xl">方案示例</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{status}</p>
      </section>
      <section className="rounded-2xl bg-sheet p-5 shadow-card">
        <h2 className="font-serif text-2xl">付款流程示例</h2>
        <p className="mt-2 text-sm leading-relaxed">示例付款流程；所有方案金額均為虛構，本頁不連接付款渠道。</p>
        {account.fpsId ? <p className="mt-2 text-sm">示例識別碼：{account.fpsId}</p> : null}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {PLANS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPlan(item.id)}
              className={`rounded-xl border px-4 py-3 text-left ${plan === item.id ? "border-ink bg-sun" : "border-line bg-sheet"}`}
            >
              <p className="font-medium">{item.name}</p>
              <p className="mt-1 font-serif text-2xl">HK${item.price.toLocaleString("en-HK")}</p>
              <p className="mt-1 text-sm text-muted">{item.blurb}</p>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="示例付款人（請勿填真實資料）">
            <input className={fieldClass} value={payerName} onChange={(event) => setPayerName(event.target.value)} />
          </Field>
          <Field label="示例付款參考（請勿填真實資料）">
            <input className={fieldClass} value={reference} onChange={(event) => setReference(event.target.value)} />
          </Field>
        </div>
        {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
        <Button
          className="mt-4"
          onClick={() => {
            setNote("");
            void requestPlan({ data: { plan, payerName, reference } })
              .then((next) => {
                setAccount(next);
                setNote("示例申請已提交；此示例不會收款或處理付款。");
              })
              .catch((error: unknown) => setNote(errText(error)));
          }}
        >
          提交示例申請
        </Button>
      </section>
    </div>
  );
}
