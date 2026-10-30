import { quoteIssues, unpricedLineCount } from "@/lib/quotes/checks";
import {
  hasQuantity,
  hasUnitPrice,
  hkd,
  lineStreet,
  lineUnit,
  quoteTotal,
} from "@/lib/quotes/money";
import { NO_SPACE, type Catalog, type Quote, type QuoteLine } from "@/lib/quotes/model";
import { quoteSpaceLabel } from "@/lib/quotes/lines";
import { propertyName } from "@/lib/quotes/remote";

export function PrintSheet({
  quote,
  catalog,
  coef,
}: {
  quote: Quote;
  catalog: Catalog;
  coef: number;
}) {
  const total = quoteTotal(quote, coef);
  const place = [quote.district, quote.address].filter(Boolean).join(" ");
  const issues = quoteIssues(quote, coef);
  const pending = unpricedLineCount(quote, coef);

  const groups = new Map<
    string,
    {
      code: string;
      title: string;
      majors: Map<number, { num: number; title: string; lines: QuoteLine[] }>;
    }
  >();
  for (const code of quote.groupCodes) {
    const group = catalog.groups.find((item) => item.group_code === code);
    if (group) groups.set(code, { code, title: group.title, majors: new Map() });
  }
  for (const line of quote.lines) {
    const major = catalog.majors.find((item) => item.major_num === line.majorNum);
    const code = major?.group_code ?? "";
    if (!groups.has(code)) {
      const group = catalog.groups.find((item) => item.group_code === code);
      groups.set(code, { code, title: group?.title ?? "其他", majors: new Map() });
    }
    const bucket = groups.get(code)!;
    if (!bucket.majors.has(line.majorNum)) {
      bucket.majors.set(line.majorNum, {
        num: line.majorNum,
        title: major?.title ?? "",
        lines: [],
      });
    }
    bucket.majors.get(line.majorNum)!.lines.push(line);
  }
  const tree = [...groups.values()]
    .filter((group) => group.majors.size > 0)
    .sort((a, b) => a.code.localeCompare(b.code));

  return (
    <article
      data-testid="quote-print-sheet"
      className="bg-sheet px-4 py-6 text-ink md:rounded-2xl md:px-8 md:py-8 md:shadow-card"
    >
      <header className="flex items-center gap-4 border-b-4 border-sun pb-4">
        <img
          src="/sample-illustration.svg"
          alt=""
          className="size-11 rounded-full border-2 border-sea object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs tracking-widest text-sea">工程報價單 · 虛構示例</p>
          <h1 className="font-serif text-2xl">裝修工程報價示例</h1>
          <p className="text-sm text-muted">所有項目及金額均為虛構 · 不可作正式報價</p>
        </div>
        <div className="text-right">
          <p className="font-serif text-lg">{quote.number}</p>
          <p className="text-sm text-muted">{quote.quoteDate}</p>
        </div>
      </header>

      {issues.length ? (
        <div className="mt-4 border-2 border-ink p-3 text-sm">
          <p className="font-semibold">草稿預覽 · 資料未齊，唔作正式報價</p>
          <p className="mt-1 text-xs">{issues.map((issue) => issue.message).join("；")}。</p>
        </div>
      ) : null}
      <h2 className="mt-5 font-serif text-xl">
        {quote.clientName || "客戶"} · {propertyName(catalog, quote.propertyType)}
      </h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">電話</dt>
          <dd>{quote.phone || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">地址</dt>
          <dd>{place || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">狀態</dt>
          <dd>
            {quote.status === "draft"
              ? "草稿"
              : quote.status === "sent"
                ? "已出"
                : quote.status === "accepted"
                  ? "已接"
                  : "未接"}
          </dd>
        </div>
      </dl>

      <div className="mt-6">
        {tree.map((group) => (
          <section key={group.code} className="mt-5 first:mt-0">
            <h3 className="border-b-2 border-sun pb-1 font-serif text-xl">
              <span className="mr-2 font-sans text-xs tracking-widest text-sea">總項</span>
              {group.code} {group.title}
            </h3>
            {[...group.majors.values()]
              .sort((a, b) => a.num - b.num)
              .map((major) => (
                <section key={major.num} className="mt-3 border-l-2 border-sea pl-3">
                  <h4 className="text-base font-medium text-sea">
                    <span className="mr-2 text-xs font-normal tracking-widest">大項</span>
                    {major.num}. {major.title}
                  </h4>
                  <ul>
                    {major.lines.map((line) => (
                      <li
                        key={line.id}
                        className="mt-2 border-b border-line pb-2 pl-3 text-sm last:border-b-0"
                      >
                        <p className="text-xs tracking-widest text-muted">
                          細項 {line.code}
                          {line.spaceId === NO_SPACE
                            ? ""
                            : ` · ${quoteSpaceLabel(quote, line.spaceId)}`}
                        </p>
                        <p className="mt-1">{line.description}</p>
                        {line.spec ? (
                          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted">
                            {line.spec}
                          </p>
                        ) : null}
                        <p className="mt-1 tabular-nums">
                          {hasUnitPrice(line, coef) ? hkd(lineUnit(line, coef)) : "單價待核"} ×{" "}
                          {hasQuantity(line) ? line.qty : "數量待確認"} {line.unit} ={" "}
                          {hasQuantity(line) && hasUnitPrice(line, coef)
                            ? hkd(lineStreet(line, coef))
                            : "待確認（未計入小計）"}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
          </section>
        ))}
        {quote.lines.length === 0 ? (
          <p className="border-t border-line py-6 text-sm text-muted">未有細項。</p>
        ) : null}
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t-4 border-sun pt-3">
        <p className="font-medium">
          {pending ? `已計價小計（另有 ${pending} 項待確認）` : "出街總額"}
        </p>
        <p className="font-serif text-3xl tabular-nums">
          {pending && pending === quote.lines.length ? "待確認" : hkd(total)}
        </p>
      </div>
      <p className="mt-2 text-sm text-muted">未列項目另計，最終以度尺及確認物料為準。</p>
      {quote.remark ? <p className="mt-3 whitespace-pre-wrap text-sm">{quote.remark}</p> : null}
      <footer className="mt-8 grid gap-6 text-sm sm:grid-cols-2">
        <p>
          客戶確認
          <span className="mt-8 block border-b border-ink" />
        </p>
        <p>
          師傅
          <span className="mt-8 block border-b border-ink" />
        </p>
      </footer>
    </article>
  );
}
