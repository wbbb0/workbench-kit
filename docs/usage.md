# Usage

`workbench-kit` is intended to be consumed as a git-managed source dependency. The recommended setup is to add this repository to each application as a submodule and reference the aggregate Vue package with a `file:` dependency.

## Add As Submodule

From the application repository root:

```bash
git submodule add https://github.com/wbbb0/workbench-kit.git vendor/workbench-kit
git submodule update --init --recursive
```

## Add Package Dependencies

If the frontend package lives at `webui/`, add dependencies relative to that package:

```json
{
  "dependencies": {
    "@workbench-kit/vue": "file:../vendor/workbench-kit/packages/vue"
  }
}
```

Then install from the application root:

```bash
npm --prefix webui install
```

The consuming app must also install the peer dependencies:

```json
{
  "dependencies": {
    "lucide-vue-next": "^1.0.0",
    "vue": "^3.5.0"
  }
}
```

## Styles

Import one theme template first, then the aggregate workbench styles once from the app stylesheet:

```css
@import "@workbench-kit/vue/theme/midnight.css";
@import "tailwindcss";
@import "@workbench-kit/vue/style.css";
```

`midnight.css` is the default dark/light template extracted from the original llm-onebot WebUI.

Apps can override any token by importing a local file after the template:

```css
@import "@workbench-kit/vue/theme/midnight.css";
@import "./theme-overrides.css";
@import "@workbench-kit/vue/style.css";
```

Example override:

```css
:root,
html[data-theme="dark"] {
  --accent: #2dd4bf;
  --accent-hover: #5eead4;
}
```

`@workbench-kit/vue/style.css` includes the Tailwind `@source` directives for all workbench-kit Vue packages. If a custom build pipeline does not process imported `@source` directives, use this single fallback source path from the app stylesheet:

```css
@source "../../../vendor/workbench-kit/packages";
```

Adjust the relative path to match the app stylesheet location.

## Page Shell And Scrolling

The aggregate style entry intentionally makes the application root a fixed-height workbench surface:

```css
html,
body,
#app,
#__nuxt {
  height: 100%;
  overflow: hidden;
}
```

Do not rely on document/body scrolling after importing `@workbench-kit/vue/style.css`. The consuming app must provide the scroll container.

For a regular Nuxt admin app, prefer `WorkbenchPageRoot`. It provides the app-height shell, internal scroll container, and the workbench runtime hosts needed by toast/menu/window composables:

```vue
<script setup lang="ts">
import { WorkbenchPageRoot } from "@workbench-kit/vue";
</script>

<template>
  <WorkbenchPageRoot title="Auth Server">
    <NuxtPage />

    <template #actions>
      <NuxtLink to="/settings/security">Security</NuxtLink>
      <NuxtLink to="/account">Account</NuxtLink>
    </template>
  </WorkbenchPageRoot>
</template>
```

If the page uses `WorkbenchRoot`, the root shell already owns the workbench-sized viewport and its internal areas own scrolling.

## Choosing A Layout API

Use the lightest workbench component that matches the application shape:

- Use `WorkbenchRoot` for full workbench-style apps that need activity navigation, workbench areas, topbar menus, statusbar items, and multi-window behavior. Mizune-core is the reference shape for this root.
- Use `WorkbenchPageRoot` for ordinary route-based admin pages that still need runtime services such as `useWorkbenchWindows()` or toasts.
- Use `WorkbenchRuntimeRoot` directly only when building another shell wrapper inside `workbench-kit`.
- Use `WorkbenchCompactPage`, `WorkbenchCardStack`, `WorkbenchFeatureCard`, `WorkbenchCard`, and primitives inside a root. `WorkbenchCompactPage` is a visual layout helper, not a runtime provider.
- Keep product-specific routing, API calls, permissions, and stores in the consuming application.

## Login Pages

Use `WorkbenchLoginPage` for shared login UI. It is intentionally UI-only: the consuming application owns session checks, password/passkey APIs, redirects, and confirmation dialogs.

```vue
<script setup lang="ts">
import { WorkbenchLoginPage } from "@workbench-kit/vue";

const username = ref("");
const password = ref("");
const pending = ref(false);

async function submitLogin() {
  pending.value = true;
  try {
    // Call the app-owned login API here.
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <WorkbenchLoginPage
    v-model:password="password"
    v-model:username="username"
    brand-label="Auth Server"
    :pending="pending"
    @submit="submitLogin"
  />
</template>
```

## Dialogs And Windows

`WorkbenchDialog` is the route-page friendly dialog primitive. It preserves a simple `v-model` API and does not require mounting `WorkbenchRoot`.

```vue
<WorkbenchDialog v-model="open" title="Edit item">
  ...
</WorkbenchDialog>
```

For movable or resizable dialogs, mount the page under `WorkbenchPageRoot` or `WorkbenchRoot` and open a runtime dialog:

```ts
import { WorkbenchMultiSelect, useWorkbenchWindows } from "@workbench-kit/vue";

const { openDialog } = useWorkbenchWindows();

const result = await openDialog<{ scopes: string[] }>({
  title: "Edit scopes",
  size: "lg",
  modal: true,
  movable: true,
  resizable: true,
  schema: {
    fields: [
      {
        kind: "custom",
        key: "scopes",
        label: "Scopes",
        defaultValue: currentScopes,
        component: WorkbenchMultiSelect,
        props: { options: allScopes }
      }
    ]
  },
  actions: [{ id: "save", label: "Save", variant: "primary" }]
});
```

`WindowSurface` is the only implementation of drag, resize, maximize, and viewport bounds. Do not implement pointer drag/resize behavior in app wrappers or primitives.

`WorkbenchConfirmDialog` is intentionally backward-compatible with the basic confirm shape:

```vue
<WorkbenchConfirmDialog
  v-model="open"
  title="Please confirm"
  message="Continue?"
  confirm-text="Confirm"
  cancel-text="Cancel"
/>
```

Optional behavior such as auto-confirm countdown should be added through optional props, not by changing the existing confirm contract.

## Theme Templates And Contract

The consuming app owns its final theme values, but it does not need to define every token from scratch. Import a template when the default look is good enough, and override only the variables that differ.

`@workbench-kit/vue/style.css` expects the resolved CSS variables to include surface, border, text, accent, state, scrollbar, font, and workbench sizing tokens. Templates provide those variables. A custom app theme can either replace the template entirely or inherit from it with overrides.
