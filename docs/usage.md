# Usage

`workbench-kit` is intended to be consumed as a git-managed source dependency. The recommended setup is to add this repository to each application as a submodule and reference its packages with `file:` dependencies.

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
    "@workbench-kit/vue-workbench": "file:../vendor/workbench-kit/packages/vue-workbench",
    "@workbench-kit/vue-resource-editor": "file:../vendor/workbench-kit/packages/vue-resource-editor",
    "@workbench-kit/vue-file-workspace": "file:../vendor/workbench-kit/packages/vue-file-workspace"
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

Import the workbench base styles once from the app stylesheet:

```css
@import "@workbench-kit/vue-workbench/style.css";
```

When using Tailwind CSS, include the source package files so utility classes used by the source packages are generated:

```css
@source "../../../vendor/workbench-kit/packages/vue-workbench/src";
@source "../../../vendor/workbench-kit/packages/vue-resource-editor/src";
@source "../../../vendor/workbench-kit/packages/vue-file-workspace/src";
```

Adjust the relative path to match the app stylesheet location.

## Theme Contract

The consuming app owns its final theme values. `@workbench-kit/vue-workbench/style.css` expects the app to provide the workbench theme tokens used by the shell and primitives, including surface, border, text, accent, state, safe-area, and workbench sizing variables.

In `llm-onebot`, these values are provided by `webui/src/style/theme.css`.

