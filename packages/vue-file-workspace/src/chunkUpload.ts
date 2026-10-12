/** A resumable transport session. Protocol, storage and authentication belong to the adapter. */
export interface ChunkUploadSession {
  id: string;
  size: number;
  chunkSize: number;
  uploadedChunks: readonly number[];
}
export interface ChunkUploadProgress {
  /** Transfer high-water mark, including in-flight chunks; retries never count twice. */
  bytes: number;
  /** Bytes acknowledged by the adapter, including resumed chunks. */
  completedBytes: number;
  totalBytes: number;
}
export interface ChunkUploadPart {
  index: number;
  blob: Blob;
  signal: AbortSignal;
  onProgress: (bytes: number) => void;
}
export interface ChunkUploadAdapter<Result, Session extends ChunkUploadSession = ChunkUploadSession> {
  createSession: (file: Blob, signal: AbortSignal) => Promise<Session>;
  uploadChunk: (session: Session, part: ChunkUploadPart) => Promise<void>;
  completeSession: (session: Session, signal: AbortSignal) => Promise<Result>;
  /** Called only for caller cancellation, after all in-flight work has settled. */
  cancelSession?: (session: Session) => Promise<void>;
  /** Opt into retries only for errors the transport knows are safe to repeat. */
  shouldRetry?: (error: unknown) => boolean;
}
export interface ChunkUploadOptions<Result, Session extends ChunkUploadSession = ChunkUploadSession> {
  file: Blob;
  adapter: ChunkUploadAdapter<Result, Session>;
  signal?: AbortSignal;
  concurrency?: number;
  /** At most two retries per chunk or completion request. */
  retries?: number;
  retryDelayMs?: number;
  onProgress?: (progress: ChunkUploadProgress) => void;
}
function abortError(): DOMException { return new DOMException("Upload cancelled", "AbortError"); }
function checkAbort(signal: AbortSignal): void { if (signal.aborted) throw abortError(); }
function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const aborted = () => { clearTimeout(timer); signal.removeEventListener("abort", aborted); reject(abortError()); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", aborted); resolve(); }, milliseconds);
    signal.addEventListener("abort", aborted, { once: true });
  });
}

/** Bounded concurrent Blob upload. A failed session remains available for an adapter-controlled retry. */
export async function uploadFileChunks<Result, Session extends ChunkUploadSession = ChunkUploadSession>(options: ChunkUploadOptions<Result, Session>): Promise<Result> {
  const { file, adapter } = options;
  const concurrency = options.concurrency ?? 4;
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 250;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32
    || !Number.isInteger(retries) || retries < 0 || retries > 2
    || !Number.isFinite(retryDelayMs) || retryDelayMs < 0) throw new Error("Invalid chunk upload options");
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  let session: Session | undefined;
  let failure: unknown;
  let failed = false;
  async function retry<T>(action: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      checkAbort(controller.signal);
      try { return await action(); }
      catch (error) {
        checkAbort(controller.signal);
        if (attempt >= retries || !adapter.shouldRetry?.(error)) throw error;
        await delay(retryDelayMs * 2 ** attempt, controller.signal);
      }
    }
  }
  try {
    checkAbort(controller.signal);
    // Creating a session is not retried blindly: only the adapter knows its idempotency contract.
    session = await adapter.createSession(file, controller.signal);
    checkAbort(controller.signal);
    if (!session.id || session.size !== file.size || !Number.isSafeInteger(session.chunkSize) || session.chunkSize <= 0
      || !Array.isArray(session.uploadedChunks)) throw new Error("Invalid chunk upload session");
    const count = Math.ceil(file.size / session.chunkSize);
    const uploaded = new Set(session.uploadedChunks);
    if ([...uploaded].some(index => !Number.isSafeInteger(index) || index < 0 || index >= count)) throw new Error("Invalid uploaded chunk index");
    const chunkBytes = (index: number) => Math.min(session!.chunkSize, file.size - index * session!.chunkSize);
    const progress = new Map<number, number>([...uploaded].map(index => [index, chunkBytes(index)]));
    let completedBytes = [...uploaded].reduce((sum, index) => sum + chunkBytes(index), 0);
    let transferredBytes = completedBytes;
    const emitProgress = () => options.onProgress?.({ bytes: transferredBytes, completedBytes, totalBytes: file.size });
    emitProgress();
    let cursor = 0;
    async function worker(): Promise<void> {
      try {
        while (!controller.signal.aborted) {
          const index = cursor++;
          if (index >= count) return;
          if (uploaded.has(index)) continue;
          const bytes = chunkBytes(index);
          const blob = file.slice(index * session!.chunkSize, index * session!.chunkSize + bytes);
          await retry(() => adapter.uploadChunk(session!, { index, blob, signal: controller.signal, onProgress: reported => {
            if (controller.signal.aborted || !Number.isFinite(reported)) return;
            const previous = progress.get(index) ?? 0;
            const next = Math.max(previous, Math.min(bytes, Math.max(0, reported)));
            progress.set(index, next);
            transferredBytes += next - previous;
            emitProgress();
          } }));
          checkAbort(controller.signal);
          uploaded.add(index);
          completedBytes += bytes;
          transferredBytes += bytes - (progress.get(index) ?? 0);
          progress.set(index, bytes);
          emitProgress();
        }
      } catch (error) {
        if (!failed) { failure = error; failed = true; }
        controller.abort();
      }
    }
    // Wait for hashing, transport abort handlers and every worker before returning or deleting the session.
    await Promise.allSettled(Array.from({ length: Math.min(concurrency, count) }, worker));
    if (options.signal?.aborted) throw abortError();
    if (failed) throw failure;
    checkAbort(controller.signal);
    const result = await retry(() => adapter.completeSession(session!, controller.signal));
    checkAbort(controller.signal);
    return result;
  } finally {
    controller.abort();
    options.signal?.removeEventListener("abort", abort);
    if (options.signal?.aborted && session) await adapter.cancelSession?.(session).catch(() => {});
  }
}
