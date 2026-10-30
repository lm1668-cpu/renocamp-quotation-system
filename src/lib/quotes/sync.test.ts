import assert from "node:assert/strict";
import test from "node:test";
import { SaveQueue } from "./sync.ts";

const wait = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

test("reads the latest snapshot when the debounce fires", async () => {
  let value = 1;
  const saved: number[] = [];
  const queue = new SaveQueue({
    read: () => value,
    save: async (snapshot) => {
      saved.push(snapshot);
    },
    delay: 5,
  });
  queue.changed();
  value = 2;
  queue.changed();
  await wait(20);
  assert.deepEqual(saved, [2]);
  queue.dispose();
});

test("serializes saves and writes a mutation made during the in-flight save", async () => {
  let value = 1;
  let inFlight = 0;
  let maxInFlight = 0;
  const saved: number[] = [];
  let release!: () => void;
  const first = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queue = new SaveQueue({
    read: () => value,
    save: async (snapshot) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      saved.push(snapshot);
      if (snapshot === 1) await first;
      inFlight -= 1;
    },
    delay: 0,
  });
  queue.changed();
  await wait(5);
  value = 2;
  queue.changed();
  release();
  await wait(20);
  assert.deepEqual(saved, [1, 2]);
  assert.equal(maxInFlight, 1);
  queue.dispose();
});

test("keeps failed data dirty and supports explicit retry", async () => {
  let attempts = 0;
  const statuses: string[] = [];
  const queue = new SaveQueue({
    read: () => ({ value: 7 }),
    save: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("offline");
    },
    onStatus: (status) => statuses.push(status),
    delay: 0,
  });
  queue.changed();
  await wait(10);
  assert.equal(queue.isDirty, true);
  assert.equal(queue.isFailed, true);
  queue.retry();
  await wait(10);
  assert.equal(attempts, 2);
  assert.equal(queue.isDirty, false);
  assert.equal(queue.isFailed, false);
  assert.deepEqual(statuses, ["saving", "failed", "saving", "saved"]);
  queue.dispose();
});

test("dispose cancels pending work and suppresses completion callbacks", async () => {
  let saves = 0;
  const statuses: string[] = [];
  const queue = new SaveQueue({
    read: () => 1,
    save: async () => {
      saves += 1;
    },
    onStatus: (s) => statuses.push(s),
    delay: 20,
  });
  queue.changed();
  assert.deepEqual(statuses, ["saving"]);
  queue.dispose();
  await wait(30);
  assert.equal(saves, 0);
  assert.deepEqual(statuses, ["saving"]);
});
