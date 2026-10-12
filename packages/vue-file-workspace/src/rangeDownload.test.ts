import { describe, expect, it, vi } from "vitest";
import { downloadWithRanges, RangeDownloadError, type RangeDownloadAdapter } from "./rangeDownload.js";

const text = "abcdefghijkl";
const info = { size: text.length, etag: '"v1"', acceptRanges: true };
function response(start: number, end: number, options: { status?: number; headers?: Record<string, string>; body?: string } = {}) {
  return new Response(options.body ?? text.slice(start, end + 1), { status: options.status ?? 206, headers: {
    "Content-Range": `bytes ${start}-${end}/${info.size}`, ETag: info.etag, "Content-Length": String(end - start + 1), ...options.headers,
  } });
}
function adapter(overrides: Partial<RangeDownloadAdapter> = {}) {
  return {
    fetchInfo: vi.fn(async () => info), fetchRange: vi.fn(async ({start, end}) => response(start, end)),
    save: vi.fn(async () => {}), fallback: vi.fn(async () => {}), ...overrides,
  } satisfies RangeDownloadAdapter;
}
describe("range download", () => {
  it("resumes only valid cached segments and saves in byte order after bounded workers finish", async () => {
    let active = 0, maxActive = 0;
    const store = vi.fn(async () => {}), clear = vi.fn(async () => {});
    const save = vi.fn(async (_data: Blob, _signal: AbortSignal) => {});
    const client = adapter({
      save,
      cache: { load: async () => new Map([[1, new Blob(["efgh"])], [2, new Blob(["corrupt"])], [99, new Blob(["invalid"])]]), store, clear },
      fetchRange: vi.fn(async ({ start, end }) => {
        active++; maxActive = Math.max(maxActive, active);
        await new Promise(resolve => setTimeout(resolve, start === 0 ? 10 : 0));
        active--; return response(start, end);
      }),
    });
    const progress = vi.fn();
    await downloadWithRanges(client, { chunkSize: 4, concurrency: 2, onProgress: progress });
    expect(maxActive).toBe(2); expect(client.fetchRange).toHaveBeenCalledTimes(2);
    expect(await save.mock.calls[0]![0].text()).toBe(text);
    expect(store).toHaveBeenCalledTimes(2); expect(clear).toHaveBeenCalledOnce();
    expect(progress.mock.calls[0]![0]).toEqual({ receivedBytes: 4, totalBytes: 12 });
    expect(progress.mock.calls.at(-1)![0]).toEqual({ receivedBytes: 12, totalBytes: 12 });
  });
  it("uses the same entry's fallback for small files or unsupported ranges and weak validators", async () => {
    for (const metadata of [{ ...info, size: 4 }, { ...info, acceptRanges: false }, { ...info, etag: "" }, { ...info, etag: 'W/"v1"' }]) {
      const client = adapter({ fetchInfo: async () => metadata });
      await downloadWithRanges(client, { chunkSize: 4 });
      expect(client.fallback).toHaveBeenCalledOnce(); expect(client.fetchRange).not.toHaveBeenCalled(); expect(client.save).not.toHaveBeenCalled();
    }
  });
  it("rejects ignored If-Range, mismatched ranges, validators and segment lengths without saving", async () => {
    const invalidResponses: NonNullable<Parameters<typeof response>[2]>[] = [
      { status: 200 }, { headers: { "Content-Range": "bytes 1-4/12" } }, { headers: { "Content-Range": "bytes 0-3/13" } },
      { headers: { ETag: '"v2"' } }, { headers: { ETag: "" } }, { headers: { "Content-Length": "3" } }, { body: "a" },
    ];
    for (const options of invalidResponses) {
      const clear = vi.fn(async () => {}), store = vi.fn(async () => {});
      const client = adapter({ fetchRange: async ({start, end}) => response(start, end, options), cache: { load: async () => new Map(), store, clear } });
      await expect(downloadWithRanges(client, { chunkSize: 4, concurrency: 1 })).rejects.toBeInstanceOf(RangeDownloadError);
      expect(client.save).not.toHaveBeenCalled(); expect(client.fallback).not.toHaveBeenCalled(); expect(store).not.toHaveBeenCalled(); expect(clear).toHaveBeenCalledOnce();
    }
  });
  it("aborts sibling workers and waits for a transport ignoring abort before returning the first failure", async () => {
    let release!: () => void;
    let secondSignal: AbortSignal | undefined;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const firstFailure = new Error("connection failed");
    const store = vi.fn(async () => {}), clear = vi.fn(async () => {});
    const client = adapter({
      cache: { load: async () => new Map(), store, clear },
      fetchRange: async ({ start, end, signal }) => {
        if (start === 0) { await Promise.resolve(); throw firstFailure; }
        secondSignal = signal; await waiting; return response(start, end);
      },
    });
    let settled = false;
    const download = downloadWithRanges(client, { chunkSize: 4, concurrency: 2 });
    void download.then(() => { settled = true; }, () => { settled = true; });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(secondSignal?.aborted).toBe(true); expect(settled).toBe(false);
    release(); await expect(download).rejects.toBe(firstFailure);
    expect(store).not.toHaveBeenCalled(); expect(client.save).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled(); // Valid partial cache can resume after transport failures.
  });
  it("honors external cancellation before fetching and while awaiting cache writes", async () => {
    const before = new AbortController(); before.abort();
    const idle = adapter(); await expect(downloadWithRanges(idle, { signal: before.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(idle.fetchInfo).not.toHaveBeenCalled();
    const controller = new AbortController(); let entered!: () => void;
    const writing = new Promise<void>(resolve => { entered = resolve; });
    const client = adapter({ cache: {
      load: async () => new Map(), clear: async () => {},
      store: async (_info, _index, _data, signal) => { entered(); await new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })); },
    } });
    const download = downloadWithRanges(client, { signal: controller.signal, chunkSize: 4, concurrency: 1 });
    await writing; controller.abort();
    await expect(download).rejects.toMatchObject({ name: "AbortError" }); expect(client.save).not.toHaveBeenCalled();
  });
  it("does not clear resumable chunks when saving fails and rejects unsafe metadata", async () => {
    const clear = vi.fn(async () => {});
    const failed = adapter({ save: async () => { throw new Error("save denied"); }, cache: { load: async () => new Map(), store: async () => {}, clear } });
    await expect(downloadWithRanges(failed, {chunkSize:4})).rejects.toThrow("save denied"); expect(clear).not.toHaveBeenCalled();
    for (const size of [-1, NaN, Infinity, 1.5]) {
      const client = adapter({ fetchInfo: async () => ({ ...info, size }) });
      await expect(downloadWithRanges(client)).rejects.toMatchObject({ code: "INVALID_METADATA" }); expect(client.fallback).not.toHaveBeenCalled();
    }
  });
  it("stops oversized streaming bodies at the requested boundary instead of buffering the entire response", async () => {
    let reads = 0, cancelled = 0;
    const client = adapter({ fetchRange: async ({ start, end }) => new Response(new ReadableStream({
      pull(controller) { reads++; controller.enqueue(new Uint8Array(3)); }, cancel() { cancelled++; },
    }), { status: 206, headers: { ETag: info.etag, "Content-Range": `bytes ${start}-${end}/${info.size}`, "Content-Length": String(end - start + 1) } }) });
    await expect(downloadWithRanges(client, { chunkSize: 4, concurrency: 1 })).rejects.toMatchObject({ code: "RANGE_MISMATCH" });
    expect(cancelled).toBe(1); expect(reads).toBeLessThanOrEqual(3); expect(client.save).not.toHaveBeenCalled();
  });
  it("cancels stalled response readers and settles them before returning cancellation", async () => {
    const controller = new AbortController(); let opened!: () => void; let cancelled = 0;
    const reading = new Promise<void>(resolve => { opened = resolve; });
    const client = adapter({ fetchRange: async ({ start, end }) => new Response(new ReadableStream({
      pull() { opened(); }, cancel() { cancelled++; },
    }), { status: 206, headers: { ETag: info.etag, "Content-Range": `bytes ${start}-${end}/${info.size}` } }) });
    const download = downloadWithRanges(client, { signal: controller.signal, chunkSize: 4, concurrency: 1 });
    const rejected = expect(download).rejects.toMatchObject({ name: "AbortError" });
    await reading; controller.abort(); await rejected;
    expect(cancelled).toBe(1); expect(client.save).not.toHaveBeenCalled();
  });
  it("preserves cancellation while a host fallback or save is pending", async () => {
    for (const fallback of [false, true]) {
      const controller = new AbortController(); let entered!: () => void; let release!: () => void;
      const waiting = new Promise<void>(resolve => { entered = resolve; });
      const action = async () => { entered(); await new Promise<void>(resolve => { release = resolve; }); };
      const client = adapter(fallback ? { fetchInfo: async () => ({ ...info, acceptRanges: false }), fallback: action } : { save: action });
      const download = downloadWithRanges(client, { signal: controller.signal, chunkSize: 4 });
      const rejected = expect(download).rejects.toMatchObject({ name: "AbortError" });
      await waiting; controller.abort(); release(); await rejected;
    }
  });
});
