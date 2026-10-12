export type RangeDownloadInfo = { size: number; etag: string; acceptRanges: boolean };
export type RangeDownloadProgress = { receivedBytes: number; totalBytes: number };
export type RangeDownloadCache = {
  load(info: RangeDownloadInfo, signal: AbortSignal): Promise<ReadonlyMap<number, Blob>>;
  store(info: RangeDownloadInfo, index: number, data: Blob, signal: AbortSignal): Promise<void>;
  clear(info: RangeDownloadInfo): Promise<void>;
};
export type RangeDownloadAdapter = {
  fetchInfo(signal: AbortSignal): Promise<RangeDownloadInfo>;
  fetchRange(request: { start: number; end: number; etag: string; signal: AbortSignal }): Promise<Response>;
  save(data: Blob, signal: AbortSignal): Promise<void>;
  fallback(signal: AbortSignal): Promise<void>;
  cache?: RangeDownloadCache;
};
export type RangeDownloadOptions = {
  chunkSize?: number; concurrency?: number; signal?: AbortSignal;
  onProgress?: (progress: RangeDownloadProgress) => void;
};
export class RangeDownloadError extends Error {
  constructor(public readonly code: "INVALID_METADATA" | "RANGE_MISMATCH" | "FILE_CHANGED", message: string) { super(message); this.name = "RangeDownloadError"; }
}
function check(signal: AbortSignal) {
  if (signal.aborted) throw signal.reason ?? new DOMException("Cancelled", "AbortError");
}
async function readChunk(response: Response, start: number, end: number, info: RangeDownloadInfo, signal: AbortSignal): Promise<Blob> {
  const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get("content-range") ?? "");
  const changed = response.headers.get("etag") !== info.etag;
  const valid = response.status === 206 && range && Number(range[1]) === start && Number(range[2]) === end && Number(range[3]) === info.size;
  const length = response.headers.get("content-length");
  if (!valid || changed || (length !== null && (!/^\d+$/.test(length) || Number(length) !== end - start + 1))) {
    await response.body?.cancel().catch(() => {});
    throw new RangeDownloadError(changed ? "FILE_CHANGED" : "RANGE_MISMATCH", "The server returned a different file or an invalid range.");
  }
  const expected = end - start + 1;
  if (!response.body) throw new RangeDownloadError("RANGE_MISMATCH", "The returned file segment is incomplete.");
  const reader = response.body.getReader();
  const parts: BlobPart[] = [];
  let received = 0;
  let cancellation: Promise<void> | undefined;
  const cancel = () => { cancellation ??= reader.cancel(signal.reason).catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    check(signal);
    while (true) {
      const { value, done } = await reader.read();
      check(signal);
      if (done) break;
      received += value.byteLength;
      if (received > expected) {
        await reader.cancel().catch(() => {});
        throw new RangeDownloadError("RANGE_MISMATCH", "The returned file segment exceeds the requested range.");
      }
      parts.push(new Uint8Array(value));
    }
    if (received !== expected) throw new RangeDownloadError("RANGE_MISMATCH", "The returned file segment is incomplete.");
    return new Blob(parts);
  } finally {
    signal.removeEventListener("abort", cancel);
    if (signal.aborted) cancel();
    await cancellation;
    reader.releaseLock();
  }
}

/** Transport, persistence, authentication and saving are supplied by the host. */
export async function downloadWithRanges(adapter: RangeDownloadAdapter, options: RangeDownloadOptions = {}): Promise<void> {
  const chunkSize = options.chunkSize ?? 4 * 1024 * 1024;
  const concurrency = options.concurrency ?? 4;
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1 || !Number.isSafeInteger(concurrency) || concurrency < 1) throw new RangeError("Invalid range download options");
  const controller = new AbortController();
  const signal = controller.signal;
  const cancel = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  let info: RangeDownloadInfo | undefined;
  try {
    check(signal);
    info = await adapter.fetchInfo(signal);
    check(signal);
    if (!Number.isSafeInteger(info.size) || info.size < 0) throw new RangeDownloadError("INVALID_METADATA", "The file size is unavailable or invalid.");
    if (!info.acceptRanges || !info.etag || info.etag.startsWith("W/") || info.size <= chunkSize) {
      await adapter.fallback(signal);
      check(signal);
      return;
    }
    const total = Math.ceil(info.size / chunkSize);
    const cached = await adapter.cache?.load(info, signal);
    check(signal);
    const chunks: Blob[] = new Array(total);
    let receivedBytes = 0;
    for (const [index, data] of cached ?? []) {
      if (Number.isInteger(index) && index >= 0 && index < total && data.size === Math.min(chunkSize, info.size - index * chunkSize)) {
        chunks[index] = data; receivedBytes += data.size;
      }
    }
    const pending = Array.from({ length: total }, (_, index) => index).filter(index => !chunks[index]);
    options.onProgress?.({ receivedBytes, totalBytes: info.size });
    let cursor = 0; let failed = false; let firstError: unknown;
    const metadata = info;
    async function worker() {
      try {
        while (cursor < pending.length) {
          check(signal);
          const index = pending[cursor++]!;
          const start = index * chunkSize, end = Math.min(metadata.size - 1, start + chunkSize - 1);
          const response = await adapter.fetchRange({ start, end, etag: metadata.etag, signal });
          if (signal.aborted) await response.body?.cancel().catch(() => {});
          check(signal);
          const data = await readChunk(response, start, end, metadata, signal);
          check(signal);
          await adapter.cache?.store(metadata, index, data, signal);
          check(signal);
          chunks[index] = data; receivedBytes += data.size;
          options.onProgress?.({ receivedBytes, totalBytes: metadata.size });
        }
      } catch (error) {
        if (!failed) { failed = true; firstError = error; controller.abort(error); }
      }
    }
    await Promise.allSettled(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
    if (failed) throw firstError;
    check(signal);
    await adapter.save(new Blob(chunks), signal);
    check(signal);
    await adapter.cache?.clear(metadata).catch(() => {});
  } catch (error) {
    if (info && error instanceof RangeDownloadError) await adapter.cache?.clear(info).catch(() => {});
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", cancel);
  }
}
