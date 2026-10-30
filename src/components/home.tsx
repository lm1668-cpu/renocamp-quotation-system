import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { hkd, quoteTotal, STATUS_LABEL } from "@/lib/quotes/money";
import { unpricedLineCount } from "@/lib/quotes/checks";
import { coefficientFor } from "@/lib/quotes/remote";
import type { Catalog } from "@/lib/quotes/model";
import { useQuoteStore } from "@/lib/quotes/store";
import { assertCanCreate, getCatalog } from "@/lib/saas/api";
import { LOGIN_REQUIRED } from "@/lib/saas/open";

const STEPS = [
  {
    n: "01",
    face: "/sample-illustration.svg",
    title: "先勾總項，再勾大項",
    body: "做邊類先勾邊類。大項喺總項裏面，唔會一次過塞晒。",
  },
  {
    n: "02",
    face: "/sample-illustration.svg",
    title: "睇規格，先揀細項",
    body: "每個大項下面先出細項。規格說明寫喺項目度，睇清楚先加入。",
  },
  {
    n: "03",
    face: "/sample-illustration.svg",
    title: "有需要先分房間",
    body: "一般細項直接加入就得。要按房間分數量／分價，先展開分區，一次揀幾個房。",
  },
];

const NOTES: Record<string, { line: string; face: string }> = {
  secondhand: { line: "最常見。執漏、翻新、執位多。", face: "/sample-illustration.svg" },
  newbuild: { line: "交樓標準，工序相對齊整。", face: "/sample-illustration.svg" },
  villa: { line: "花園、路遠、工序多，所以貴少少。", face: "/sample-illustration.svg" },
  office: { line: "要避營業時間，趕工多。", face: "/sample-illustration.svg" },
};

const FAQ = [
  {
    face: "/sample-illustration.svg",
    q: "單價可唔可以改？",
    a: "示例單價可以修改；本目錄及所有金額均為虛構，不可用作正式報價。",
  },
  {
    face: "/sample-illustration.svg",
    q: "會唔會自動塞晒成套工程？",
    a: "唔會。你勾邊項先有邊項。唔想做嘅，唔勾就得，唔使自己刪。",
  },
  {
    face: "/sample-illustration.svg",
    q: "兩間房、兩個廁所點加？",
    a: "唔係每項都要分區。需要時先開「分區設定」，房同浴室撳「＋」，亦可以改名。同一細項可一次加入幾個房，數量同單價各自填。",
  },
  {
    face: "/sample-illustration.svg",
    q: "張單留喺邊？",
    a: LOGIN_REQUIRED
      ? "報價單跟隨登入帳戶保存。"
      : "此示例不連接私人資料庫；只用虛構資料測試，切勿輸入真實客戶或工程資料。",
  },
  {
    face: "/sample-illustration.svg",
    q: "呢個數係咪實數？",
    a: "呢張係報價底稿。度尺、物料品牌、拆開牆先見到嘅嘢，最終以現場確認為準。",
  },
];

export function Home() {
  const quotes = useQuoteStore((state) => state.quotes);
  const hydrated = useQuoteStore((state) => state.hydrated);
  const createQuote = useQuoteStore((state) => state.createQuote);
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [block, setBlock] = useState("");
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    void getCatalog()
      .then((result) => setCatalog(result.catalog))
      .catch(() => undefined);
  }, []);

  function openQuote() {
    if (opening || !hydrated) return;
    setBlock("");
    setOpening(true);
    void assertCanCreate()
      .then((result) => {
        if (!result.ok) {
          setBlock(result.message);
          return;
        }
        const id = createQuote();
        void navigate({ to: "/quote/$id", params: { id } });
      })
      .catch(() => setBlock("而家開唔到新單，請再試一次。"))
      .finally(() => setOpening(false));
  }

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-4 md:px-6">
        <div className="grid items-stretch gap-4 md:grid-cols-2">
          <img src="/sample-illustration.svg" alt="裝修工程報價流程示例插圖" className="hero-team" />
          <div className="flex flex-col justify-center rounded-2xl bg-sheet p-5 shadow-card md:p-6">
            <p className="text-xs font-medium tracking-widest text-sea">
              可靠師傅 · 好手藝 · 報價自己話事
            </p>
            <h1 className="mt-2 font-serif text-3xl leading-tight">未開單，我哋先同你講明白點計</h1>
            <p className="mt-3 text-base leading-relaxed text-ink">
              呢度係裝修工程報價系統示例。先勾總項同大項，再睇規格揀細項。一般項目直接加入；有需要先按房間分開。
              你揀邊項先有邊項，唔使每項都分區。
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex shrink-0">
                {[
                  "/sample-illustration.svg",
                  "/sample-illustration.svg",
                  "/sample-illustration.svg",
                  "/sample-illustration.svg",
                  "/sample-illustration.svg",
                ].map((src, index) => (
                  <img
                    key={src}
                    src={src}
                    alt=""
                    className="face size-8 rounded-full border-2 border-sheet"
                    style={{ marginLeft: index === 0 ? 0 : -10 }}
                  />
                ))}
              </div>
              <p className="text-sm text-muted">先揀工程，分區係可選，唔係必填。</p>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button disabled={!hydrated || opening} aria-busy={opening} onClick={openQuote}>
                {opening ? "開緊新單…" : "開新報價"}
              </Button>
              <p className="text-sm text-muted">自動儲存到報價簿，改完即時計數。</p>
            </div>
            {block ? (
              <p role="alert" className="mt-3 text-sm text-muted">
                {block}{" "}
                <Link to="/plan" className="underline">
                  去收費
                </Link>
              </p>
            ) : null}
          </div>
        </div>

        <section className="mt-6">
          <h2 className="font-serif text-2xl">點樣用</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            三步就明。入面可以前後跳，唔使由頭嚟過。
          </p>
          <ol className="mt-4 grid gap-3 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n} className="rounded-2xl bg-sheet p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <img
                    src={step.face}
                    alt=""
                    className="face size-10 rounded-full border-2 border-sea-soft"
                  />
                  <p className="font-serif text-2xl text-sea">{step.n}</p>
                </div>
                <h3 className="mt-3 font-medium">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl bg-sheet shadow-card">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="font-serif text-2xl">報價簿</h2>
              <p className="text-sm text-muted">開咗嘅單喺下面。撳入去可以改，唔使由頭勾。</p>
            </div>
            <Button disabled={!hydrated || opening} aria-busy={opening} onClick={openQuote}>
              {opening ? "開緊新單…" : "再開一張"}
            </Button>
          </div>
          {quotes.length === 0 ? (
            <div className="flex items-center gap-4 px-5 py-8">
              <img
                src="/sample-illustration.svg"
                alt=""
                className="face size-11 shrink-0 rounded-full"
              />
              <p className="text-sm leading-relaxed text-muted">
                未有報價。撳上面開張新單，由邊種樓開始勾。
              </p>
            </div>
          ) : (
            <ul>
              {quotes.map((quote) => {
                const preset = catalog ? coefficientFor(catalog, quote.propertyType) : 1;
                const coef = quote.coefficient ?? preset;
                const pending = unpricedLineCount(quote, coef);
                const name = catalog?.coefficients.find(
                  (row) => row.property_type === quote.propertyType,
                )?.name;
                return (
                  <li key={quote.id} className="border-b border-line last:border-b-0">
                    <Link
                      to="/quote/$id"
                      params={{ id: quote.id }}
                      className="flex flex-col gap-1 px-5 py-4 hover:bg-sea-soft sm:flex-row sm:items-center sm:gap-6"
                    >
                      <div className="flex items-center gap-3 sm:w-36">
                        <img
                          src={NOTES[quote.propertyType]?.face ?? "/sample-illustration.svg"}
                          alt=""
                          className="face size-7 shrink-0 rounded-full"
                        />
                        <div>
                          <p className="font-serif">{quote.number}</p>
                          <p className="text-xs text-muted">{quote.updatedAt}</p>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{quote.clientName || "未填客戶"}</p>
                        <p className="truncate text-sm text-muted">
                          {[name, quote.district, quote.address].filter(Boolean).join(" · ") ||
                            "未填地址"}
                          {` · ${quote.lines.length} 項${pending ? `（${pending} 項待確認）` : ""}`}
                        </p>
                      </div>
                      <div className="sm:text-right">
                        <p className="font-serif text-xl tabular-nums">
                          {pending && pending === quote.lines.length
                            ? "待確認"
                            : hkd(quoteTotal(quote, coef))}
                        </p>
                        <p className="text-sm text-sea">{STATUS_LABEL[quote.status]}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-2xl">師傅想知</h2>
          <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl bg-sheet shadow-card">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="flex items-center gap-3 font-medium">
                  <img src={item.face} alt="" className="face size-7 rounded-full" />
                  {item.q}
                </summary>
                <p className="mt-2 pl-14 text-sm leading-relaxed text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
