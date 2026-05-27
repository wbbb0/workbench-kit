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

## Theme Templates And Contract

The consuming app owns its final theme values, but it does not need to define every token from scratch. Import a template when the default look is good enough, and override only the variables that differ.

`@workbench-kit/vue/style.css` expects the resolved CSS variables to include surface, border, text, accent, state, scrollbar, font, and workbench sizing tokens. Templates provide those variables. A custom app theme can either replace the template entirely or inherit from it with overrides.
