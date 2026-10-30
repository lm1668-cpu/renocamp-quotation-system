import { hasQuantity, hasUnitPrice } from "./money.ts";
import { NO_SPACE, WHOLE_SPACE, type Quote } from "./model.ts";

export type QuoteIssue = {
  field: "clientName" | "address" | "quoteDate" | "coefficient" | "lines";
  message: string;
};

export function pendingQuantityCount(quote: Pick<Quote, "lines">) {
  return quote.lines.filter((line) => !hasQuantity(line)).length;
}

export function unpricedLineCount(quote: Pick<Quote, "lines">, coefficient: number) {
  return quote.lines.filter((line) => !hasQuantity(line) || !hasUnitPrice(line, coefficient))
    .length;
}

export function quoteIssues(quote: Quote, coefficient: number): QuoteIssue[] {
  const issues: QuoteIssue[] = [];
  if (!quote.clientName.trim()) issues.push({ field: "clientName", message: "未填客戶稱呼" });
  if (!quote.address.trim()) issues.push({ field: "address", message: "未填施工地址" });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(quote.quoteDate)
    ? new Date(`${quote.quoteDate}T00:00:00Z`)
    : null;
  if (
    !date ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== quote.quoteDate
  ) {
    issues.push({ field: "quoteDate", message: "未填有效報價日期" });
  }
  if (!Number.isFinite(coefficient) || coefficient <= 0) {
    issues.push({ field: "coefficient", message: "報價系數要大過 0" });
  }
  if (quote.lines.length === 0) {
    issues.push({ field: "lines", message: "未加入任何工程細項" });
    return issues;
  }
  const pending = pendingQuantityCount(quote);
  if (pending)
    issues.push({ field: "lines", message: `有 ${pending} 項數量待確認，請填大過 0 嘅數量` });
  const descriptions = quote.lines.filter(
    (line) => !line.description.trim() || !line.unit.trim(),
  ).length;
  if (descriptions)
    issues.push({ field: "lines", message: `有 ${descriptions} 項未填工程描述或單位` });
  const invalidPrices = quote.lines.filter((line) => !hasUnitPrice(line, coefficient)).length;
  if (invalidPrices)
    issues.push({
      field: "lines",
      message: `有 ${invalidPrices} 項單價待核，請先填單價；免費項目要明確輸入 0`,
    });
  const orphaned = quote.lines.filter(
    (line) =>
      line.spaceId !== NO_SPACE &&
      line.spaceId !== WHOLE_SPACE &&
      !quote.spaces.some((space) => space.id === line.spaceId),
  ).length;
  if (orphaned)
    issues.push({ field: "lines", message: `有 ${orphaned} 項區域已不存在，請重新揀區域` });
  return issues;
}
