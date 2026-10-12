import { describe, expect, it, vi } from "vitest";
import { uploadFileChunks, type ChunkUploadAdapter, type ChunkUploadProgress, type ChunkUploadSession } from "./chunkUpload.js";

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const file = () => new Blob(["abcdefghij"]);
const session = (blob: Blob, uploadedChunks: number[] = []): ChunkUploadSession => ({ id: "session", size: blob.size, chunkSize: 2, uploadedChunks });
function adapter(overrides: Partial<ChunkUploadAdapter<string>> = {}): ChunkUploadAdapter<string> {
  return { createSession: async blob => session(blob), uploadChunk: async () => {}, completeSession: async () => "done", ...overrides };
}

describe("chunk upload scheduling", () => {
  it("bounds concurrent slices, resumes acknowledged chunks and counts retries only once", async () => {
    let active = 0, peak = 0, completeAttempts = 0;
    const attempts = new Map<number, number>();
    const progress: ChunkUploadProgress[] = [];
    const result = await uploadFileChunks({ file: file(), concurrency: 2, retryDelayMs: 0, onProgress: value => progress.push(value), adapter: adapter({
      createSession: async blob => session(blob, [1]),
      shouldRetry: error => (error as { transient?: boolean }).transient === true,
      async uploadChunk(_session, part) {
        active++; peak = Math.max(peak, active);
        try {
          const attempt = (attempts.get(part.index) ?? 0) + 1; attempts.set(part.index, attempt);
          expect(part.blob.size).toBe(2);
          part.onProgress(0); part.onProgress(1);
          await Promise.resolve();
          if (part.index === 0 && attempt === 1) throw { transient: true };
          part.onProgress(100); part.onProgress(0);
        } finally { active--; }
      },
      async completeSession() { if (++completeAttempts === 1) throw { transient: true }; return "done"; },
    }) });
    expect(result).toBe("done"); expect(peak).toBe(2); expect(active).toBe(0);
    expect(attempts.get(0)).toBe(2); expect(attempts.has(1)).toBe(false); expect(completeAttempts).toBe(2);
    expect(progress[0]).toEqual({ bytes: 2, completedBytes: 2, totalBytes: 10 });
    expect(progress.at(-1)).toEqual({ bytes: 10, completedBytes: 10, totalBytes: 10 });
    progress.forEach((value, index) => {
      expect(value.bytes).toBeLessThanOrEqual(10); expect(value.completedBytes).toBeLessThanOrEqual(value.bytes);
      if (index) { expect(value.bytes).toBeGreaterThanOrEqual(progress[index - 1]!.bytes); expect(value.completedBytes).toBeGreaterThanOrEqual(progress[index - 1]!.completedBytes); }
    });
  });
  it("aborts every peer on the first failure and waits for their cleanup while preserving the failed session", async () => {
    const events: string[] = []; const failed = deferred<void>();
    const error = new Error("permission denied"); let started = 0;
    const cancelSession = vi.fn(); const completeSession = vi.fn();
    const result = uploadFileChunks({ file: file(), adapter: adapter({ cancelSession, completeSession,
      async uploadChunk(_session, part) {
        started++;
        if (part.index === 0) return failed.promise;
        await new Promise<void>(resolve => part.signal.addEventListener("abort", () => {
          setTimeout(() => { events.push(`settled-${part.index}`); resolve(); }, 5);
        }, { once: true }));
      },
    }) });
    const rejected = expect(result).rejects.toBe(error);
    await vi.waitFor(() => expect(started).toBe(4));
    failed.reject(error);
    await rejected;
    expect(events).toHaveLength(3); expect(cancelSession).not.toHaveBeenCalled(); expect(completeSession).not.toHaveBeenCalled(); expect(started).toBe(4);
  });
  it("caller cancellation settles all workers before session cancellation and removes abort listeners", async () => {
    const controller = new AbortController(); const events: string[] = []; let started = 0;
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const result = uploadFileChunks({ file: file(), signal: controller.signal, adapter: adapter({
      async uploadChunk(_session, part) {
        started++;
        await new Promise<void>(resolve => part.signal.addEventListener("abort", () => { queueMicrotask(() => { events.push("worker"); resolve(); }); }, { once: true }));
      },
      async cancelSession() { events.push("cancel-session"); },
    }) });
    const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(started).toBe(4)); controller.abort(); await rejected;
    expect(events).toEqual(["worker", "worker", "worker", "worker", "cancel-session"]); expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
  it("supports empty files and rejects cancellation before session creation", async () => {
    const uploadChunk = vi.fn(), completeSession = vi.fn(async () => "empty");
    expect(await uploadFileChunks({ file: new Blob(), adapter: adapter({ uploadChunk, completeSession }) })).toBe("empty");
    expect(uploadChunk).not.toHaveBeenCalled(); expect(completeSession).toHaveBeenCalledOnce();
    const controller = new AbortController(); controller.abort(); const createSession = vi.fn();
    await expect(uploadFileChunks({ file: file(), signal: controller.signal, adapter: adapter({ createSession }) })).rejects.toMatchObject({ name: "AbortError" });
    expect(createSession).not.toHaveBeenCalled();
  });
  it("caps retry attempts and requires the adapter to classify errors as retryable", async () => {
    for (const retryable of [false, true]) {
      const uploadChunk = vi.fn(async () => { throw new Error("failure"); });
      await expect(uploadFileChunks({ file: new Blob(["ab"]), retryDelayMs: 0, adapter: adapter({ uploadChunk, shouldRetry: () => retryable }) })).rejects.toThrow("failure");
      expect(uploadChunk).toHaveBeenCalledTimes(retryable ? 3 : 1);
    }
  });
  it("cancels a session returned late after caller cancellation and validates resume boundaries", async () => {
    const controller = new AbortController(); const created = deferred<ChunkUploadSession>(); const cancelSession = vi.fn(async () => {});
    const result = uploadFileChunks({ file: file(), signal: controller.signal, adapter: adapter({ createSession: () => created.promise, cancelSession }) });
    const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
    controller.abort(); created.resolve(session(file())); await rejected; expect(cancelSession).toHaveBeenCalledOnce();
    for (const uploadedChunks of [[-1], [5], [0.5]]) {
      await expect(uploadFileChunks({ file: file(), adapter: adapter({ createSession: async blob => session(blob, uploadedChunks) }) })).rejects.toThrow("Invalid uploaded chunk index");
    }
  });
});
