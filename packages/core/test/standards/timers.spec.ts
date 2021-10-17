import { setTimeout } from "timers/promises";
import { inputGatedSetInterval, inputGatedSetTimeout } from "@miniflare/core";
import {
  TestInputGate,
  triggerPromise,
  waitsForInputGate,
} from "@miniflare/shared-test";
import test from "ava";

test("inputGatedSetTimeout: calls callback with no input gate in context", async (t) => {
  const [trigger, promise] = triggerPromise<[number, string]>();
  inputGatedSetTimeout((a, b) => trigger([a, b]), 10, 42, "test");
  t.deepEqual(await promise, [42, "test"]);
});
test("inputGatedSetTimeout: can cancel timeout", async (t) => {
  const handle = inputGatedSetTimeout(() => t.fail(), 10);
  clearTimeout(handle);
  await setTimeout(100);
  t.pass();
});
test("inputGatedSetTimeout: waits for input gate to open before calling callback", async (t) => {
  const result = await waitsForInputGate(t, () => {
    const [trigger, promise] = triggerPromise<[number, string]>();
    inputGatedSetTimeout((a, b) => trigger([a, b]), 10, 42, "test");
    return promise;
  });
  t.deepEqual(result, [42, "test"]);
});

test("inputGatedSetInterval: calls callback with no input gate in context", async (t) => {
  let [trigger, promise] = triggerPromise<[number, string]>();
  const handle = inputGatedSetInterval(
    (a, b) => trigger([a, b]),
    10,
    42,
    "test"
  );
  t.deepEqual(await promise, [42, "test"]);
  [trigger, promise] = triggerPromise<[number, string]>();
  t.deepEqual(await promise, [42, "test"]);
  clearInterval(handle);
});
test("inputGatedSetInterval: can cancel interval", async (t) => {
  const handle = inputGatedSetInterval(() => t.fail(), 10);
  clearInterval(handle);
  await setTimeout(100);
  t.pass();
});
test("inputGatedSetInterval: waits for input gate to open before calling callback", async (t) => {
  const inputGate = new TestInputGate();
  const events: number[] = [];

  // Check with first callback
  let [trigger, promise] = triggerPromise<[number, string]>();
  let [openTrigger, openPromise] = triggerPromise<void>();
  const handlePromise = inputGate.runWith(async () => {
    // Close input gate
    // noinspection ES6MissingAwait
    void inputGate.runWithClosed(() => openPromise);
    const handle = inputGatedSetInterval(
      (a, b) => trigger([a, b]),
      10,
      42,
      "test"
    );
    await promise;
    events.push(1);
    return handle;
  });
  await inputGate.waitedPromise;
  inputGate.resetWaitedPromise();
  events.push(2);
  openTrigger();
  const handle = await handlePromise;
  t.deepEqual(events, [2, 1]);

  // Check with second callback
  [trigger, promise] = triggerPromise<[number, string]>();
  [openTrigger, openPromise] = triggerPromise<void>();
  const callbackPromise = inputGate.runWith(async () => {
    // Close input gate again
    // noinspection ES6MissingAwait
    void inputGate.runWithClosed(() => openPromise);
    await promise;
    events.push(3);
  });
  await inputGate.waitedPromise;
  events.push(4);
  openTrigger();
  await callbackPromise;
  t.deepEqual(events, [2, 1, 4, 3]);

  clearInterval(handle);
});