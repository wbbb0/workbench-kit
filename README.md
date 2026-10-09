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
