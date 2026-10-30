import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Copy, Printer, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PrintSheet } from "@/components/print-sheet";
import { Button, Field, Modal, areaClass, fieldClass } from "@/components/ui";
import { cn } from "@/lib/cn";
import { quoteIssues, unpricedLineCount } from "@/lib/quotes/checks";
import { makeQuoteLines, quoteSpaceLabel } from "@/lib/quotes/lines";
import {
  DISTRICTS,
  hasQuantity,
  hasUnitPrice,
  hkd,
  lineStreet,
  lineUnit,
  quoteTotal,
  STATUS_LABEL,
  streetUnit,
} from "@/lib/quotes/money";
import {
  NO_SPACE,
  WHOLE_SPACE,
  type Catalog,
  type Quote,
  type SpaceDef,
  type StandardItem,
} from "@/lib/quotes/model";
import { coefficientFor } from "@/lib/quotes/remote";
import { getCatalog, assertCanCreate } from "@/lib/saas/api";
import { useQuoteStore } from "@/lib/quotes/store";

const STEPS = [
  { id: "groups", label: "總項" },
  { id: "majors", label: "大項" },
  { id: "items", label: "細項" },
  { id: "sheet", label: "出街單" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const PROPERTY_ORDER = ["secondhand", "newbuild", "villa", "office"];

const GROUP_FACE: Record<string, string> = {
  A: "/sample-illustration.svg",
  B: "/sample-illustration.svg",
  C: "/sample-illustration.svg",
  D: "/sample-illustration.svg",
  E: "/sample-illustration.svg",
  F: "/sample-illustration.svg",
};

const STEP_FACE = {
  groups: "/sample-illustration.svg",
  majors: "/sample-illustration.svg",
  items: "/sample-illustration.svg",
  sheet: "/sample-illustration.svg",
} as const;

function NumberBox({
  value,
  onCommit,
  allowEmpty,
  className,
  ariaLabel,
  placeholder,
  invalid,
}: {
  value: number | null;
  onCommit: (value: number | null) => void;
  allowEmpty: boolean;
  className: string;
  ariaLabel?: string;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const started = useRef("");
  return (
    <input
      className={className}
      inputMode="decimal"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      placeholder={placeholder}
      value={draft ?? (value == null ? "" : String(value))}
      onFocus={() => {
        const text = value == null ? "" : String(value);
        started.current = text;
        setDraft(text);
      }}
      onChange={(event) => {
        const raw = event.target.value;
        if (!/^\d*\.?\d*$/.test(raw)) return;
        setDraft(raw);
        if (raw === "" || raw === "." || raw.endsWith(".")) return;
        const next = Number(raw);
        if (Number.isFinite(next)) onCommit(next);
      }}
      onBlur={() => {
        const raw = (draft ?? "").trim();
        if (raw !== started.current) {
          if (raw === "" || raw === ".") onCommit(allowEmpty ? null : 0);
          else {
            const next = Number(raw);
            if (Number.isFinite(next)) onCommit(next);
          }
        }
        setDraft(null);
      }}
    />
  );
}

function StepHead({ face, title, children }: { face: string; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <img
        src={face}
        alt=""
        className="face size-10 shrink-0 rounded-full border-2 border-sea-soft"
      />
      <div>
        <h2 className="font-serif text-2xl">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  );
}

export function Builder({ id }: { id: string }) {
  const hydrated = useQuoteStore((state) => state.hydrated);
  const quote = useQuoteStore((state) => state.quotes.find((item) => item.id === id));
  const patchQuote = useQuoteStore((state) => state.patchQuote);
  const duplicateQuote = useQuoteStore((state) => state.duplicateQuote);
  const removeQuote = useQuoteStore((state) => state.removeQuote);
  const navigate = useNavigate();
  const [step, setStep] = useState<StepId>("groups");
  const [loaded, setLoaded] = useState<Awaited<ReturnType<typeof getCatalog>> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [actionError, setActionError] = useState("");
  const [copying, setCopying] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<{
    count: number;
    update: (current: Quote) => Quote;
  } | null>(null);

  useEffect(() => {
    let live = true;
    setCatalogError(false);
    void getCatalog()
      .then((result) => {
        if (live) setLoaded(result);
      })
      .catch(() => {
        if (live) setCatalogError(true);
      });
    return () => {
      live = false;
    };
  }, [catalogAttempt]);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-muted">報價簿開緊。</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-3xl">搵唔到呢張單</h1>
        <Link to="/" className="mt-4 inline-flex h-11 items-center text-sea underline">
          返回報價簿
        </Link>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-3xl">{quote.number}</h1>
        {catalogError ? (
          <div role="alert" className="mt-3">
            <p className="text-sm text-muted">目錄暫時讀唔到，張單未有改動。可以再試一次。</p>
            <Button className="mt-3" onClick={() => setCatalogAttempt((attempt) => attempt + 1)}>
              重新讀目錄
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">目錄讀緊，等一陣。</p>
        )}
      </div>
    );
  }

  const catalog = loaded.catalog;
  const preset = coefficientFor(catalog, quote.propertyType);
  const coef = quote.coefficient ?? preset;
  const total = quoteTotal(quote, coef);
  const pending = unpricedLineCount(quote, coef);
  const issues = quoteIssues(quote, coef);

  function patch(updater: (current: Quote) => Quote) {
    const current = useQuoteStore.getState().quotes.find((entry) => entry.id === id);
    if (!current) return;
    if (step === "groups" || step === "majors") {
      const next = updater(current);
      const count = current.lines.filter(
        (line) => !next.lines.some((entry) => entry.id === line.id),
      ).length;
      if (count) {
        setPendingRemoval({ count, update: updater });
        return;
      }
    }
    patchQuote(quote!.id, updater);
  }

  function goStep(next: StepId) {
    setStep(next);
    requestAnimationFrame(() => {
      document.getElementById("quote-step")?.scrollIntoView({ block: "start" });
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 pb-36 md:px-6">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link
          to="/"
          className="inline-flex h-11 items-center gap-1 rounded-lg px-2 text-sm hover:bg-sea-soft"
        >
          <ArrowLeft className="size-4" />
          報價簿
        </Link>
        <p className="font-serif text-lg">{quote.number}</p>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="sheet" onClick={() => goStep("sheet")}>
            <Printer className="size-4" />
            報價單
          </Button>
          <Button
            variant="sheet"
            disabled={copying}
            onClick={() => {
              setActionError("");
              setCopying(true);
              void assertCanCreate()
                .then((result) => {
                  if (!result.ok) {
                    setActionError(result.message);
                    return;
                  }
                  const copyId = duplicateQuote(quote.id);
                  if (copyId) void navigate({ to: "/quote/$id", params: { id: copyId } });
                })
                .catch(() => setActionError("而家複製唔到，原單未有改動。請再試一次。"))
                .finally(() => setCopying(false));
            }}
          >
            <Copy className="size-4" />
            {copying ? "複製緊…" : "複製"}
          </Button>
          {confirmDelete ? (
            <>
              <Button
                variant="sea"
                onClick={() => {
                  removeQuote(quote.id);
                  void navigate({ to: "/" });
                }}
              >
                確認刪除
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                取消
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" />
              刪除
            </Button>
          )}
        </div>
      </div>

      {actionError ? (
        <p
          role="alert"
          className="no-print mb-4 rounded-lg border border-line bg-sheet p-3 text-sm"
        >
          {actionError}
        </p>
      ) : null}
      <PropertyStep quote={quote} catalog={catalog} patch={patch} />
      <Modal
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null);
        }}
        title="取消呢個工種？"
        description={`會移除 ${pendingRemoval?.count ?? 0} 個已填細項，包括數量、單價同規格。其他工種唔受影響。`}
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="sea"
            onClick={() => {
              if (pendingRemoval) patchQuote(id, pendingRemoval.update);
              setPendingRemoval(null);
            }}
          >
            確認移除 {pendingRemoval?.count ?? 0} 項
          </Button>
          <Button variant="sheet" onClick={() => setPendingRemoval(null)}>
            保留內容
          </Button>
        </div>
      </Modal>

      <div id="step-nav" className="no-print mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => goStep(item.id)}
            aria-current={step === item.id ? "step" : undefined}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-lg px-2 text-sm",
              step === item.id ? "bg-ink text-sun" : "bg-sheet text-ink shadow-card",
            )}
          >
            <img src={STEP_FACE[item.id]} alt="" className="face size-6 shrink-0 rounded-full" />
            {index + 1} {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div id="quote-step" className="min-w-0 scroll-mt-4 lg:col-span-2">
          {step === "groups" ? <GroupStep quote={quote} catalog={catalog} patch={patch} /> : null}
          {step === "majors" ? <MajorStep quote={quote} catalog={catalog} patch={patch} /> : null}
          {step === "items" ? (
            <ItemStep quote={quote} catalog={catalog} coef={coef} patch={patch} />
          ) : null}
          {step === "sheet" ? (
            <SheetStep
              quote={quote}
              catalog={catalog}
              coef={coef}
              patch={patch}
              onEditItems={() => goStep("items")}
            />
          ) : null}
        </div>
        <aside className="no-print lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl bg-sheet p-5 shadow-card">
            <div className="flex items-center gap-3">
              <img
                src="/sample-illustration.svg"
                alt=""
                className="face size-10 shrink-0 rounded-full"
              />
              <div>
                <p className="text-xs tracking-widest text-sea">
                  {pending ? "已計價小計" : "出街總額"}
                </p>
                <p className="font-serif text-4xl tabular-nums">
                  {pending && pending === quote.lines.length ? "待確認" : hkd(total)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              已加 {quote.lines.length} 項。
              {pending
                ? `有 ${pending} 項數量或單價待確認，暫時未計入小計。`
                : "數量、單價同規格都可以再改。"}
            </p>
            <p className="mt-2 text-xs text-muted">
              {issues.length
                ? `仲有 ${issues.length} 項資料要核對，依家可以先睇草稿。`
                : "出街前檢查已齊，可以預覽同列印。"}
            </p>
            <button
              type="button"
              className="mt-3 text-sm text-sea underline"
              onClick={() => goStep("sheet")}
            >
              {issues.length ? "睇草稿預覽" : "睇出街單"}
            </button>
          </div>
        </aside>
      </div>
      <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-sheet/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-6xl">
          {step === "sheet" ? (
            <p className="mb-2 text-center text-xs text-muted">
              檢查清楚先出街。列印唔會自動改報價狀態。
            </p>
          ) : step === "groups" && quote.groupCodes.length === 0 ? (
            <p className="mb-2 text-center text-xs text-muted">
              先勾最少一個總項，下一步先有大項揀。
            </p>
          ) : step === "majors" && quote.majorNums.length === 0 ? (
            <p className="mb-2 text-center text-xs text-muted">
              先勾最少一個大項，下一步先有細項揀。
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              variant="sheet"
              className="h-12 flex-1"
              disabled={step === "groups"}
              onClick={() => {
                const index = STEPS.findIndex((item) => item.id === step);
                const prev = STEPS[index - 1];
                if (prev) goStep(prev.id);
              }}
            >
              返上一步
            </Button>
            {step === "sheet" ? (
              <p className="flex h-12 flex-1 items-center justify-center rounded-lg bg-sea-soft text-sm">
                最後一步
              </p>
            ) : (
              <Button
                className="h-12 flex-1"
                disabled={
                  (step === "groups" && quote.groupCodes.length === 0) ||
                  (step === "majors" && quote.majorNums.length === 0)
                }
                onClick={() => {
                  const index = STEPS.findIndex((item) => item.id === step);
                  const next = STEPS[index + 1];
                  if (next) goStep(next.id);
                }}
              >
                {step === "groups" ? "去揀大項" : step === "majors" ? "去揀細項" : "檢查出街單"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PropertyStep({
  quote,
  catalog,
  patch,
}: {
  quote: Quote;
  catalog: Catalog;
  patch: (updater: (current: Quote) => Quote) => void;
}) {
  const coeffs = [...catalog.coefficients].sort(
    (a, b) => PROPERTY_ORDER.indexOf(a.property_type) - PROPERTY_ORDER.indexOf(b.property_type),
  );
  const preset = coefficientFor(catalog, quote.propertyType);
  return (
    <section
      id="quote-details"
      className="no-print mb-4 scroll-mt-4 rounded-2xl bg-sheet p-4 shadow-card"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="樓類型">
          <select
            className={fieldClass}
            value={quote.propertyType}
            onChange={(event) => {
              const propertyType = event.target.value;
              const previous = coefficientFor(catalog, quote.propertyType);
              const keepCustom = quote.coefficient != null && quote.coefficient !== previous;
              patch((current) => ({
                ...current,
                propertyType,
                coefficient: keepCustom ? current.coefficient : null,
              }));
            }}
          >
            {coeffs.map((row) => (
              <option key={row.property_type} value={row.property_type}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="客戶稱呼">
          <input
            className={fieldClass}
            value={quote.clientName}
            autoComplete="off"
            aria-required="true"
            onChange={(event) => {
              const clientName = event.target.value;
              patch((current) => ({ ...current, clientName }));
            }}
          />
        </Field>
        <Field label="電話">
          <input
            className={fieldClass}
            inputMode="tel"
            autoComplete="off"
            value={quote.phone}
            onChange={(event) => {
              const phone = event.target.value;
              patch((current) => ({ ...current, phone }));
            }}
          />
        </Field>
        <Field label="地區">
          <select
            className={fieldClass}
            value={quote.district}
            onChange={(event) => {
              const district = event.target.value;
              patch((current) => ({ ...current, district }));
            }}
          >
            <option value="">未選</option>
            {DISTRICTS.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </Field>
        <Field label="地址">
          <input
            className={fieldClass}
            value={quote.address}
            aria-required="true"
            onChange={(event) => {
              const address = event.target.value;
              patch((current) => ({ ...current, address }));
            }}
          />
        </Field>
        <Field label="報價日期">
          <input
            type="date"
            className={fieldClass}
            value={quote.quoteDate}
            aria-required="true"
            onChange={(event) => {
              const quoteDate = event.target.value;
              patch((current) => ({ ...current, quoteDate }));
            }}
          />
        </Field>
        <Field label="報價系數">
          <NumberBox
            className={fieldClass}
            ariaLabel="報價系數"
            allowEmpty
            invalid={(quote.coefficient ?? preset) <= 0}
            value={quote.coefficient ?? preset}
            onCommit={(coefficient) => {
              patch((current) => ({ ...current, coefficient }));
            }}
          />
        </Field>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        出街前要填客戶稱呼、施工地址同報價日期；電話同地區可以留空。
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>目錄成本 × 系數 = 預設單價。呢類物業預設 {preset}；已自訂嘅單價唔會跟系數再改。</span>
        {quote.coefficient != null ? (
          <button
            type="button"
            className="min-h-11 underline"
            onClick={() => patch((current) => ({ ...current, coefficient: null }))}
          >
            還原預設系數
          </button>
        ) : null}
      </div>
    </section>
  );
}

function GroupStep({
  quote,
  catalog,
  patch,
}: {
  quote: Quote;
  catalog: Catalog;
  patch: (updater: (current: Quote) => Quote) => void;
}) {
  return (
    <section className="rounded-2xl bg-sheet p-4 shadow-card md:p-5">
      <StepHead face={STEP_FACE.groups} title="1. 勾總項">
        做邊類先勾邊類。取消會移除相關大項同細項；有已填內容會先問你，唔會靜靜刪走。
      </StepHead>
      <ul className="mt-4 grid gap-2">
        {catalog.groups.map((group) => {
          const on = quote.groupCodes.includes(group.group_code);
          const count = catalog.majors.filter(
            (major) => major.group_code === group.group_code,
          ).length;
          return (
            <li key={group.group_code}>
              <button
                type="button"
                onClick={() => {
                  patch((current) => {
                    const groupCodes = on
                      ? current.groupCodes.filter((code) => code !== group.group_code)
                      : [...current.groupCodes, group.group_code];
                    const allowed = new Set(
                      catalog.majors
                        .filter((major) => groupCodes.includes(major.group_code))
                        .map((major) => major.major_num),
                    );
                    const majorNums = current.majorNums.filter((num) => allowed.has(num));
                    const lines = current.lines.filter((line) => majorNums.includes(line.majorNum));
                    return { ...current, groupCodes, majorNums, lines };
                  });
                }}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left",
                  on ? "bg-sun" : "bg-sea-soft",
                )}
              >
                <img
                  src={GROUP_FACE[group.group_code] ?? "/sample-illustration.svg"}
                  alt=""
                  className="face size-10 shrink-0 rounded-full border-2 border-sheet"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{group.title}</span>
                  <span className="block text-sm text-muted">{count} 個大項</span>
                </span>
                <span className="text-sm">{on ? "勾咗" : "未勾"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MajorStep({
  quote,
  catalog,
  patch,
}: {
  quote: Quote;
  catalog: Catalog;
  patch: (updater: (current: Quote) => Quote) => void;
}) {
  const [query, setQuery] = useState("");
  const majors = catalog.majors.filter((major) => quote.groupCodes.includes(major.group_code));
  const needle = query.trim();
  const shown = majors.filter(
    (major) => !needle || `${major.major_num} ${major.title}`.includes(needle),
  );
  return (
    <section className="rounded-2xl bg-sheet p-4 shadow-card md:p-5">
      <StepHead face={STEP_FACE.majors} title="2. 勾大項">
        {quote.groupCodes.length === 0
          ? "未勾總項。返上一步揀大類，呢度先會有得勾。"
          : `已勾 ${quote.majorNums.length} 個大項。大項裏面先會有細項。`}
      </StepHead>
      <input
        className={`${fieldClass} mt-3`}
        value={query}
        placeholder="搵大項，例如泥水、油漆"
        aria-label="搜尋大項"
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul className="mt-3 grid gap-2">
        {shown.map((major) => {
          const on = quote.majorNums.includes(major.major_num);
          const group = catalog.groups.find((item) => item.group_code === major.group_code);
          return (
            <li key={major.major_num}>
              <label
                className={cn(
                  "flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl px-3",
                  on ? "bg-sun" : "bg-sea-soft",
                )}
              >
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-sea"
                  checked={on}
                  onChange={() => {
                    patch((current) => {
                      const majorNums = on
                        ? current.majorNums.filter((num) => num !== major.major_num)
                        : [...current.majorNums, major.major_num];
                      const lines = current.lines.filter((line) =>
                        majorNums.includes(line.majorNum),
                      );
                      return { ...current, majorNums, lines };
                    });
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {major.major_num}. {major.title}
                  </span>
                  <span className="block text-xs text-muted">
                    {group?.group_code} {group?.title}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 ? <p className="py-6 text-sm text-muted">冇大項符合。</p> : null}
    </section>
  );
}

function toggleFixed(
  quote: Quote,
  space: SpaceDef,
  patch: (updater: (current: Quote) => Quote) => void,
) {
  const existing = quote.spaces.find((item) => item.spaceCode === space.space_code);
  patch((current) => {
    if (existing) {
      return {
        ...current,
        spaces: current.spaces.filter((item) => item.id !== existing.id),
        lines: current.lines.map((line) =>
          line.spaceId === existing.id ? { ...line, spaceId: NO_SPACE } : line,
        ),
      };
    }
    return {
      ...current,
      spaces: [
        ...current.spaces,
        { id: crypto.randomUUID(), spaceCode: space.space_code, title: space.title },
      ],
    };
  });
}

function ItemStep({
  quote,
  catalog,
  coef,
  patch,
}: {
  quote: Quote;
  catalog: Catalog;
  coef: number;
  patch: (updater: (current: Quote) => Quote) => void;
}) {
  const majors = catalog.majors.filter((major) => quote.majorNums.includes(major.major_num));
  const [majorNum, setMajorNum] = useState<number | null>(majors[0]?.major_num ?? null);
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const active = majors.some((major) => major.major_num === majorNum)
    ? majorNum
    : (majors[0]?.major_num ?? null);
  const needle = query.trim().toLocaleLowerCase();
  const items = catalog.items.filter(
    (item) =>
      item.major_num === active &&
      (!needle ||
        `${item.code} ${item.description} ${item.spec ?? ""}`
          .toLocaleLowerCase()
          .includes(needle)) &&
      (!selectedOnly || quote.lines.some((line) => line.itemId === item.id)),
  );

  return (
    <section className="rounded-2xl bg-sheet p-4 shadow-card md:p-5">
      <StepHead face={STEP_FACE.items} title="3. 揀細項">
        {majors.length === 0
          ? "未勾大項。返上一步勾完，細項同規格先會出現。"
          : "一般工程直接加入，唔使分區。需要按房間分數量／分價，先展開嗰項嘅分區選擇。描述同規格照樣可以逐行改。"}
      </StepHead>
      <details id="quote-space-settings" className="mt-4 rounded-xl border border-line p-3">
        <summary className="cursor-pointer text-sm font-medium">
          分區設定（可選）
          {quote.spaces.length ? ` · 已設 ${quote.spaces.length} 個區域` : " · 需要按房間報先開"}
        </summary>
        <SpaceBar quote={quote} catalog={catalog} patch={patch} />
      </details>
      {majors.length === 0 ? null : (
        <label className="mt-4 block">
          <span className="mb-1 block text-xs text-muted">而家睇緊邊個大項</span>
          <select
            className={fieldClass}
            value={active ?? ""}
            onChange={(event) => setMajorNum(Number(event.target.value))}
          >
            {majors.map((major) => (
              <option key={major.major_num} value={major.major_num}>
                {major.major_num}. {major.title}（已加{" "}
                {quote.lines.filter((line) => line.majorNum === major.major_num).length} 項）
              </option>
            ))}
          </select>
        </label>
      )}
      {majors.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className={cn(fieldClass, "flex-1 basis-48")}
            aria-label="搜尋細項"
            placeholder="搵細項編號、工程或規格"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button
            variant={selectedOnly ? "sea" : "sheet"}
            aria-pressed={selectedOnly}
            onClick={() => setSelectedOnly((current) => !current)}
          >
            只睇已加細項
          </Button>
        </div>
      ) : null}
      <ul className="mt-2 divide-y divide-line">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} quote={quote} coef={coef} patch={patch} />
        ))}
      </ul>
      {majors.length > 0 && items.length === 0 ? (
        <p className="py-6 text-sm text-muted">
          冇符合嘅細項。可以清除搜尋，或者關掉「只睇已加細項」。
        </p>
      ) : null}
    </section>
  );
}

function SpaceBar({
  quote,
  catalog,
  patch,
}: {
  quote: Quote;
  catalog: Catalog;
  patch: (updater: (current: Quote) => Quote) => void;
}) {
  const fixed = catalog.spaces.filter((space) => !space.is_repeatable);
  const repeatable = catalog.spaces.filter((space) => space.is_repeatable);
  const [removing, setRemoving] = useState<string | null>(null);
  const affected = quote.lines.filter((line) => line.spaceId === removing).length;
  function removeSpace(id: string) {
    patch((current) => ({
      ...current,
      spaces: current.spaces.filter((space) => space.id !== id),
      lines: current.lines.map((line) =>
        line.spaceId === id ? { ...line, spaceId: NO_SPACE } : line,
      ),
    }));
  }
  function requestRemoval(id: string) {
    if (quote.lines.some((line) => line.spaceId === id)) setRemoving(id);
    else removeSpace(id);
  }
  return (
    <div className="mt-4 rounded-xl bg-sea-soft p-3">
      <p className="text-sm font-medium">今次工程區域</p>
      <p className="mt-1 text-xs text-muted">
        全屋項目唔使另外加。房／廁可以加多個，下面可以改名。
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {fixed.map((space) => {
          const existing = quote.spaces.find((item) => item.spaceCode === space.space_code);
          const on = Boolean(existing);
          return (
            <button
              key={space.space_code}
              type="button"
              aria-pressed={on}
              onClick={() =>
                existing ? requestRemoval(existing.id) : toggleFixed(quote, space, patch)
              }
              className={cn(
                "h-11 rounded-lg px-3 text-sm",
                on ? "bg-sun text-ink" : "bg-sheet text-ink",
              )}
            >
              {space.title}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {repeatable.map((space) => (
          <Button
            key={space.space_code}
            variant="sheet"
            onClick={() => {
              patch((current) => {
                let number = 1;
                while (current.spaces.some((item) => item.title === `${space.title} ${number}`))
                  number += 1;
                return {
                  ...current,
                  spaces: [
                    ...current.spaces,
                    {
                      id: crypto.randomUUID(),
                      spaceCode: space.space_code,
                      title: `${space.title} ${number}`,
                    },
                  ],
                };
              });
            }}
          >
            ＋ {space.title}
          </Button>
        ))}
      </div>
      {quote.spaces.length ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {quote.spaces.map((space) => (
            <li key={space.id} className="flex items-center gap-2">
              <input
                className={fieldClass}
                aria-label={`區域名稱 ${space.title}`}
                value={space.title}
                onChange={(event) => {
                  const title = event.target.value;
                  patch((current) => ({
                    ...current,
                    spaces: current.spaces.map((entry) =>
                      entry.id === space.id ? { ...entry, title } : entry,
                    ),
                  }));
                }}
                onBlur={() => {
                  if (!space.title.trim())
                    patch((current) => ({
                      ...current,
                      spaces: current.spaces.map((entry) =>
                        entry.id === space.id
                          ? {
                              ...entry,
                              title:
                                catalog.spaces.find((row) => row.space_code === entry.spaceCode)
                                  ?.title ?? "未命名區域",
                            }
                          : entry,
                      ),
                    }));
                }}
              />
              <button
                type="button"
                className="grid size-11 shrink-0 place-items-center rounded-lg bg-sheet"
                aria-label={`移除區域 ${space.title}`}
                onClick={() => requestRemoval(space.id)}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Modal
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="移除呢個區域？"
        description={`有 ${affected} 個細項喺呢個區域。繼續只會取消分區，唔會擴大成全屋工程；描述、數量、單價同規格全部保留。`}
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="sea"
            onClick={() => {
              if (removing) removeSpace(removing);
              setRemoving(null);
            }}
          >
            移除區域，細項改為不分區
          </Button>
          <Button variant="sheet" onClick={() => setRemoving(null)}>
            保留區域
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function ItemRow({
  item,
  quote,
  coef,
  patch,
}: {
  item: StandardItem;
  quote: Quote;
  coef: number;
  patch: (updater: (current: Quote) => Quote) => void;
}) {
  const [regional, setRegional] = useState(false);
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
  const [editingSpace, setEditingSpace] = useState<string | null>(null);
  const added = quote.lines.filter((line) => line.itemId === item.id);
  const street = streetUnit(item.cost_price, coef);
  const noSpaceCount = added.filter((line) => line.spaceId === NO_SPACE).length;
  const choices = [{ id: WHOLE_SPACE, title: "全屋" }, ...quote.spaces];
  const chosen = selectedSpaces.filter((id) => choices.some((space) => space.id === id));
  const hasCatalogPrice = hasUnitPrice({ costPrice: item.cost_price }, coef);
  function addToSpaces(spaceIds: string[]) {
    patch((current) => {
      const valid = spaceIds.filter(
        (id) =>
          id === NO_SPACE || id === WHOLE_SPACE || current.spaces.some((space) => space.id === id),
      );
      return { ...current, lines: [...current.lines, ...makeQuoteLines(item, valid)] };
    });
    setSelectedSpaces([]);
    setRegional(false);
  }
  return (
    <li aria-label={`目錄細項 ${item.code}`} className="py-4">
      <p className="text-xs text-sea">
        {item.code} · {item.unit}
      </p>
      <p className="mt-1 font-medium">{item.description}</p>
      {item.spec ? <p className="mt-1 text-sm leading-relaxed text-muted">{item.spec}</p> : null}
      <p className="mt-1 text-sm tabular-nums text-muted">
        {hasCatalogPrice
          ? `預設單價 ${hkd(street)} / ${item.unit}`
          : "目錄未有價，加入後要自行核價；唔係免費項目。"}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button onClick={() => addToSpaces([NO_SPACE])}>
          {noSpaceCount ? "再加不分區一行" : "直接加入（不分區）"}
        </Button>
        <Button
          variant="sheet"
          aria-expanded={regional}
          onClick={() => setRegional((open) => !open)}
        >
          {regional ? "收起分區選擇" : "按房間分開報"}
        </Button>
      </div>
      {regional ? (
        <fieldset className="mt-3 rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-medium">同一細項加到邊幾個區域？</legend>
          <p className="text-xs text-muted">可以一次揀幾個。每區獨立一行，數量同單價各自填。</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {choices.map((space) => {
              const count = added.filter((line) => line.spaceId === space.id).length;
              return (
                <label
                  key={space.id}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-sea-soft px-3 text-sm"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-sea"
                    aria-label={`加入區域 ${space.title}`}
                    checked={chosen.includes(space.id)}
                    onChange={(event) =>
                      setSelectedSpaces((current) =>
                        event.target.checked
                          ? [...current, space.id]
                          : current.filter((id) => id !== space.id),
                      )
                    }
                  />
                  {space.title}
                  {count ? `（已有 ${count} 行）` : ""}
                </label>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="sea"
              disabled={chosen.length === 0}
              onClick={() => addToSpaces(chosen)}
            >
              加入已揀 {chosen.length} 個區域
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                const settings = document.getElementById("quote-space-settings");
                if (settings instanceof HTMLDetailsElement) settings.open = true;
                settings?.scrollIntoView({ block: "start", behavior: "smooth" });
              }}
            >
              設定／改名分區
            </Button>
          </div>
        </fieldset>
      ) : null}
      {added.length > 0 ? (
        <ul className="mt-2 grid gap-2">
          {added.map((line) => (
            <li
              key={line.id}
              aria-label={`${line.code} 已加第 ${added.indexOf(line) + 1} 行`}
              className="rounded-lg bg-sea-soft px-3 py-2 text-sm"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="min-w-0 flex-1 text-xs text-muted">
                  已加第 {added.indexOf(line) + 1} 行 · {quoteSpaceLabel(quote, line.spaceId)}
                </span>
                <button
                  type="button"
                  aria-label={`移除 ${line.code} 第 ${added.indexOf(line) + 1} 行`}
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-sheet text-ink"
                  onClick={() => {
                    patch((current) => ({
                      ...current,
                      lines: current.lines.filter((entry) => entry.id !== line.id),
                    }));
                  }}
                >
                  <X className="size-5" />
                </button>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">工程描述（只改呢張單）</span>
                <textarea
                  className={areaClass}
                  rows={2}
                  aria-label="工程描述"
                  value={line.description}
                  onChange={(event) => {
                    const description = event.target.value;
                    patch((current) => ({
                      ...current,
                      lines: current.lines.map((entry) =>
                        entry.id === line.id ? { ...entry, description } : entry,
                      ),
                    }));
                  }}
                />
              </label>
              <p className="mt-2 text-xs text-muted">詳細規格／物料／做法／唔包項目</p>
              <textarea
                className={cn(areaClass, "mt-2")}
                rows={3}
                aria-label="詳細規格"
                placeholder="呢張單嘅詳細規格，可以改"
                value={line.spec ?? ""}
                onChange={(event) => {
                  const spec = event.target.value;
                  patch((current) => ({
                    ...current,
                    lines: current.lines.map((entry) =>
                      entry.id === line.id ? { ...entry, spec } : entry,
                    ),
                  }));
                }}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {editingSpace === line.id ? (
                  <select
                    className="h-11 min-w-28 rounded-lg border border-line bg-sheet px-2"
                    aria-label="改區域"
                    value={line.spaceId}
                    onChange={(event) => {
                      const spaceId = event.target.value;
                      patch((current) => ({
                        ...current,
                        lines: current.lines.map((entry) =>
                          entry.id === line.id ? { ...entry, spaceId } : entry,
                        ),
                      }));
                      setEditingSpace(null);
                    }}
                  >
                    <option value={NO_SPACE}>不分區</option>
                    <option value={WHOLE_SPACE}>全屋</option>
                    {quote.spaces.map((space) => (
                      <option key={space.id} value={space.id}>
                        {space.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Button variant="ghost" onClick={() => setEditingSpace(line.id)}>
                    {line.spaceId === NO_SPACE ? "指定分區（可選）" : "改分區"}
                  </Button>
                )}
                <label className="flex items-center gap-2">
                  數量
                  <NumberBox
                    className="h-11 w-20 rounded-lg border border-line bg-sheet px-2 text-right tabular-nums"
                    ariaLabel="數量"
                    allowEmpty
                    placeholder="待填"
                    invalid={!hasQuantity(line)}
                    value={line.qty}
                    onCommit={(qty) => {
                      patch((current) => ({
                        ...current,
                        lines: current.lines.map((entry) =>
                          entry.id === line.id ? { ...entry, qty } : entry,
                        ),
                      }));
                    }}
                  />
                </label>
                <label className="flex items-center gap-2">
                  單位
                  <input
                    className="h-11 w-24 rounded-lg border border-line bg-sheet px-2"
                    aria-label="計價單位"
                    value={line.unit}
                    onChange={(event) => {
                      const unit = event.target.value;
                      patch((current) => ({
                        ...current,
                        lines: current.lines.map((entry) =>
                          entry.id === line.id ? { ...entry, unit } : entry,
                        ),
                      }));
                    }}
                  />
                </label>
                <label className="flex items-center gap-2">
                  單價
                  <NumberBox
                    className="h-11 w-28 rounded-lg border border-line bg-sheet px-2 text-right tabular-nums"
                    ariaLabel="單價"
                    allowEmpty
                    placeholder="待核價"
                    invalid={!hasUnitPrice(line, coef)}
                    value={hasUnitPrice(line, coef) ? lineUnit(line, coef) : null}
                    onCommit={(unitPrice) => {
                      patch((current) => ({
                        ...current,
                        lines: current.lines.map((entry) =>
                          entry.id === line.id
                            ? {
                                ...entry,
                                unitPrice: unitPrice == null ? null : Math.round(unitPrice),
                              }
                            : entry,
                        ),
                      }));
                    }}
                  />
                </label>
                <span className="font-medium tabular-nums">
                  {hasQuantity(line) && hasUnitPrice(line, coef)
                    ? hkd(lineStreet(line, coef))
                    : "待確認，未計價"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                <span>
                  {line.unitPrice != null
                    ? "已用自訂單價，唔跟物業系數變。"
                    : hasCatalogPrice
                      ? "用緊目錄成本 × 報價系數。"
                      : "單價待核；免費項目請明確輸入 0。"}{" "}
                  單價以港幣整數計；改單位後記得核對數量同單價。
                </span>
                {line.unitPrice != null ? (
                  <button
                    type="button"
                    className="min-h-11 underline"
                    onClick={() =>
                      patch((current) => ({
                        ...current,
                        lines: current.lines.map((entry) =>
                          entry.id === line.id ? { ...entry, unitPrice: null } : entry,
                        ),
                      }))
                    }
                  >
                    還原目錄單價
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function SheetStep({
  quote,
  catalog,
  coef,
  patch,
  onEditItems,
}: {
  quote: Quote;
  catalog: Catalog;
  coef: number;
  patch: (updater: (current: Quote) => Quote) => void;
  onEditItems: () => void;
}) {
  const issues = quoteIssues(quote, coef);
  return (
    <div>
      <div className="no-print mb-3">
        <StepHead face={STEP_FACE.sheet} title="4. 檢查出街單">
          先核對客戶、地址、工程範圍同價錢。預覽唔等於已出單，下面嘅狀態要自己確認。
        </StepHead>
      </div>
      {issues.length ? (
        <div
          role="status"
          className="no-print mb-3 rounded-xl border border-sun bg-sheet p-4 text-sm"
        >
          <p className="font-medium">仲有資料未齊，下面暫時係草稿預覽。</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {issues.map((issue, index) => (
              <li key={`${issue.field}-${index}`}>{issue.message}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {issues.some((issue) => issue.field !== "lines") ? (
              <Button
                variant="sheet"
                onClick={() =>
                  document
                    .getElementById("quote-details")
                    ?.scrollIntoView({ block: "start", behavior: "smooth" })
                }
              >
                返去補基本資料
              </Button>
            ) : null}
            {issues.some((issue) => issue.field === "lines") ? (
              <Button variant="sheet" onClick={onEditItems}>
                返去補細項
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p role="status" className="no-print mb-3 rounded-xl bg-sea-soft p-3 text-sm">
          基本資料同計價檢查已齊，請再核對實際施工範圍，確認後就可以列印。
        </p>
      )}
      <div className="no-print mb-3 grid grid-cols-2 items-end gap-2">
        <Field label="狀態">
          <select
            className={fieldClass}
            value={quote.status}
            onChange={(event) => {
              const status = event.target.value as Quote["status"];
              patch((current) => ({ ...current, status }));
            }}
          >
            {Object.entries(STATUS_LABEL).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Button
          variant="sea"
          className="w-full px-2"
          disabled={issues.length > 0}
          onClick={() => {
            if (quoteIssues(quote, coef).length === 0) window.print();
          }}
        >
          <Printer className="size-4" />
          列印或儲存 PDF
        </Button>
      </div>
      {issues.length ? (
        <p className="no-print mb-3 text-xs text-muted">
          補齊上面列出嘅資料，列印按鈕先會啟用。電話同地區唔係必填。
        </p>
      ) : null}
      <Field label="備註" className="no-print mb-3">
        <textarea
          className={areaClass}
          rows={3}
          value={quote.remark}
          placeholder="例如：窗料要度尺，加長銅喉另計。"
          onChange={(event) => {
            const remark = event.target.value;
            patch((current) => ({ ...current, remark }));
          }}
        />
      </Field>
      <PrintSheet quote={quote} catalog={catalog} coef={coef} />
    </div>
  );
}
