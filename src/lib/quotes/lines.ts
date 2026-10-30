import { NO_SPACE, WHOLE_SPACE, type Quote, type QuoteLine, type StandardItem } from "./model.ts";

export function initialQuantity(unit: string): number | null {
  return unit.trim() === "項" ? 1 : null;
}

export function makeQuoteLines(item: StandardItem, spaceIds: string[] = [NO_SPACE]): QuoteLine[] {
  return [...new Set(spaceIds)].map((spaceId) => ({
    id: crypto.randomUUID(),
    itemId: item.id,
    majorNum: item.major_num,
    code: item.code,
    description: item.description,
    spec: item.spec ?? "",
    unit: item.unit,
    costPrice: item.cost_price,
    qty: initialQuantity(item.unit),
    spaceId,
  }));
}

export function quoteSpaceLabel(quote: Pick<Quote, "spaces">, spaceId: string) {
  if (spaceId === NO_SPACE) return "不分區";
  if (spaceId === WHOLE_SPACE) return "全屋";
  return quote.spaces.find((space) => space.id === spaceId)?.title ?? "區域待確認";
}
