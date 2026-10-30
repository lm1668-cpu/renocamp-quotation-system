import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { todayStamp } from "./money";
import type { Quote, QuoteLine, QuoteStatus } from "./model";

type State = {
  quotes: Quote[];
  seq: number;
  hydrated: boolean;
  createQuote: () => string;
  patchQuote: (id: string, updater: (quote: Quote) => Quote) => void;
  duplicateQuote: (id: string) => string | null;
  removeQuote: (id: string) => void;
};

function memoryStorage() {
  const jar = new Map<string, string>();
  return {
    getItem: (key: string) => jar.get(key) ?? null,
    setItem: (key: string, value: string) => {
      jar.set(key, value);
    },
    removeItem: (key: string) => {
      jar.delete(key);
    },
  };
}

function uid() {
  return crypto.randomUUID();
}

function nextNumber(seq: number) {
  return `Q-${todayStamp().slice(0, 4)}-${String(seq).padStart(3, "0")}`;
}

function blankQuote(id: string, number: string): Quote {
  const today = todayStamp();
  return {
    id,
    number,
    status: "draft",
    createdAt: today,
    updatedAt: today,
    quoteDate: today,
    propertyType: "secondhand",
    clientName: "",
    phone: "",
    district: "",
    address: "",
    coefficient: null,
    groupCodes: [],
    majorNums: [],
    spaces: [],
    lines: [],
    remark: "",
  };
}

export const useQuoteStore = create<State>()(
  persist(
    (set, get) => ({
      quotes: [],
      seq: 0,
      hydrated: false,
      createQuote: () => {
        const seq = get().seq + 1;
        const quote = blankQuote(uid(), nextNumber(seq));
        set({ quotes: [quote, ...get().quotes], seq });
        return quote.id;
      },
      patchQuote: (id, updater) => {
        set({
          quotes: get().quotes.map((quote) => {
            if (quote.id !== id) return quote;
            const next = updater(quote);
            return { ...next, id: quote.id, number: quote.number, createdAt: quote.createdAt, updatedAt: todayStamp() };
          }),
        });
      },
      duplicateQuote: (id) => {
        const source = get().quotes.find((quote) => quote.id === id);
        if (!source) return null;
        const seq = get().seq + 1;
        const today = todayStamp();
        const copy: Quote = {
          ...source,
          id: uid(),
          number: nextNumber(seq),
          status: "draft",
          createdAt: today,
          updatedAt: today,
          quoteDate: today,
          spaces: source.spaces.map((space) => ({ ...space })),
          lines: source.lines.map((line) => ({ ...line, id: uid() })),
          groupCodes: [...source.groupCodes],
          majorNums: [...source.majorNums],
        };
        set({ quotes: [copy, ...get().quotes], seq });
        return copy.id;
      },
      removeQuote: (id) => set({ quotes: get().quotes.filter((quote) => quote.id !== id) }),
    }),
    {
      name: "camp-quote-v2",
      skipHydration: true,
      storage: createJSONStorage(() => (typeof window === "undefined" ? memoryStorage() : window.localStorage)),
      partialize: (state) => ({ quotes: state.quotes, seq: state.seq }),
    },
  ),
);

let rehydrateOnce: Promise<void> | null = null;

export function rehydrateQuotes() {
  if (useQuoteStore.persist.hasHydrated()) {
    if (!useQuoteStore.getState().hydrated) useQuoteStore.setState({ hydrated: true });
    return Promise.resolve();
  }
  if (!rehydrateOnce) {
    rehydrateOnce = Promise.resolve(useQuoteStore.persist.rehydrate()).then(
      () => {
        useQuoteStore.setState({ hydrated: true });
      },
      () => {
        useQuoteStore.setState({ hydrated: true });
      },
    );
  }
  return rehydrateOnce;
}

export type { QuoteLine, QuoteStatus };
