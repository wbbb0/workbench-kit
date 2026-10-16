# workbench-kit

Personal Vue workbench UI primitives and source packages.

This repository is public for convenience, but it is maintained for personal projects first. It is not published to the npm registry and does not currently promise a stable public API.

## Packages

- `@workbench-kit/vue`: recommended aggregate entry for application projects.
- `@workbench-kit/vue-workbench`: workbench shell, navigation, menus, toasts, windows, layout primitives, and base styles.
- `@workbench-kit/vue-resource-editor`: schema-driven resource editor state and Vue components.
- `@workbench-kit/vue-file-workspace`: file tree and file workspace contracts.

## Docs

- [Usage](docs/usage.md)
- [Workflow](docs/workflow.md)

## Editor-style tabs

`WorkbenchDynamicTabs` supports optional `appearance="editor"` for adjacent,
square tabs with separators and an accent line on the active tab. Existing
consumers keep the default rounded appearance. Selection, closing, dragging,
and the compact tab menu use the same props and events in either appearance.
The size scale is shared by expanded tabs and compact controls, including touch:

| Size | Height | Horizontal padding | Label / icon |
| --- | --- | --- | --- |
| `xs` | 1.5rem (24px) | 0.375rem | 11px / 12px |
| `sm` | 1.75rem (28px) | 0.5rem | 12px / 14px |
| `md` (default) | 2rem (32px) | 0.625rem | 12px / 14px |
| `lg` | 2.5rem (40px) | 0.75rem | 14px / 16px |

Pixel equivalents assume a 16px root font size. Add/compact action buttons are
square and vertically centered; close targets scale within the tab height.
This replaces the earlier size mappings and the temporary `tabHeight` override.
Choose `lg` when larger touch targets are preferred; responsive collapse changes
the presentation without changing the selected size.

## Responsive breadcrumbs

`WorkbenchBreadcrumbs` preserves its complete-path display by default. Opt into
`autoCollapse` to show every segment when space allows, and move intermediate
ancestors into a navigation menu as the available width shrinks:

```vue
<WorkbenchBreadcrumbs class="min-w-0 flex-1" :items="pathItems" auto-collapse />
```

Items accept `label` with optional `href` or `onSelect`. The first and last
segments remain visible; exceptionally long labels truncate with a title.
Container resizing and label changes update the visible path. An explicit
`maxItems` remains an upper limit, including when `autoCollapse` is enabled.
Without `autoCollapse`, existing `maxItems` behavior remains unchanged.

## Error feedback

Applications normalize their transport or domain errors into `WorkbenchErrorInfo`.
The library displays this information without interpreting API paths, permissions,
or operation policies:

```ts
import { useWorkbenchErrors, type WorkbenchErrorInfo } from "@workbench-kit/vue";

const errors = useWorkbenchErrors();
const problem: WorkbenchErrorInfo = {
  code: "RESOURCE_BUSY",
  message: "The resource is currently in use.",
  hint: "Close its other editor and try again.",
  requestId: "request-123",
  retryable: true
};
errors.show(problem, { id: "save-resource", retry: () => saveResource() });
```

`show()` returns the runtime window ID. `id` is an optional deduplication key,
not the runtime window ID. Explicit keys keep separate operations independent;
only the same key is deduplicated. Without a key, the same code and message,
or nonempty request ID, focuses the existing error window. Its original information
and retry callback are retained. Closing the window allows the error to be shown again. Retries
require an explicit callback and a user click; `retryable: false` hides that action.
Retry failures keep the window open and show the failure reason.

`WorkbenchErrorPanel` also works on its own with an `info` prop. It exposes
optional technical details and copies error information with the Clipboard API;
if access is denied, it offers a selected, read-only text field for manual copying.
The error window uses content-sized runtime layout with a single acknowledgement
button. Other windows keep their default close label; `closeLabel` is an optional
runtime window setting for hosts that need a different caption.

## 分块上传

`uploadFileChunks(options)` 及 `ChunkUploadAdapter`、`ChunkUploadSession`、
`ChunkUploadPart`、`ChunkUploadProgress`、`ChunkUploadOptions` 从
`@workbench-kit/vue-file-workspace` 和聚合入口 `@workbench-kit/vue` 导出。
传入 `file: Blob` 和 `adapter`；adapter 注入 `createSession`、`uploadChunk`、
`completeSession`，以及可选的 `cancelSession` 和 `shouldRetry`。
会话包含 `id`、`size`、`chunkSize` 和 `uploadedChunks`，调度器按会话块大小
调用 `Blob.slice()`，跳过已完成的块。接口地址、认证、校验摘要和会话存储由业务
adapter 负责；`createSession` 也可以返回经业务校验的已有会话以恢复上传。

`concurrency` 默认 4，`retries` 默认 2 且最多为 2；只有 adapter 的
`shouldRetry(error)` 返回 `true` 时，块上传和完成请求才会重试。
创建会话不会自动重试。`retryDelayMs` 默认 250 毫秒，重试使用指数退避。
`onProgress` 提供传输高水位 `bytes`、已确认的 `completedBytes` 和 `totalBytes`，
重试不会重复累计进度。空文件直接完成会话，无需上传块。

可传入 `AbortSignal` 取消。取消或一个 worker 失败时，会中止其他 worker 并等待
所有在途工作结束；仅调用方取消会在收敛后调用可选的 `cancelSession`。
普通失败保留会话，供业务 adapter 在显式重试时恢复。adapter 应遵守收到的
signal，并在传输和相关异步工作结束后才返回。调度器没有内建的上传总时长限制，
请求超时策略由 adapter 和服务端控制。

## Range downloads

`downloadWithRanges(adapter, options)` accepts host adapters for `fetchInfo`,
`fetchRange`, `save`, and `fallback`, plus optional cache `load`/`store`/`clear`.
The host retains its URLs, authentication, storage keys, and saving policy.
Options include `signal`, `onProgress`, `chunkSize` (default 4 MiB), and
`concurrency` (default 4). Cache indices correspond to that chunk size, so include
the size and remote validator in the host's cache identity.

Every segment must match the requested Content-Range, total size, ETag, and byte
length. Unsupported ranges, weak/missing validators, and small files use the
host's fallback through the same entry. An unexpected 200 response to If-Range
fails rather than combining different versions. Failure aborts sibling workers
and waits for them to finish; cache adapters should honor the provided signal.
Successful saves and invalid responses clear the cache. Transport, cancellation,
and save failures retain valid partial cache for an explicit retry.
