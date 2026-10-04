# @workbench-kit/vue-file-workspace

通用文件工作区组件包，提供文件树组件、文件列表/预览类型和 `FileWorkspaceClient` 契约。

这个包只负责渲染文件树和定义文件 API 形状，不负责请求后端、预览器、权限、安全过滤或业务语义。业务项目负责实现 client adapter，并维护展开目录、选中文件和预览状态。

## 依赖

业务项目需要提供 peer dependencies：

```bash
npm install vue lucide-vue-next @workbench-kit/vue-workbench
```

推荐通过 `workbench-kit` submodule 和 `file:` 依赖使用：

```json
{
  "dependencies": {
    "@workbench-kit/vue-file-workspace": "file:../vendor/workbench-kit/packages/vue-file-workspace"
  }
}
```

完整接入方式见仓库根目录的 `docs/usage.md`。

## 样式和 Tailwind source

本包的 `FileTree` 依赖 `@workbench-kit/vue-workbench` 的 `TreeNodeShell` 和基础样式。业务项目必须先完成 workbench 样式接入，可以直接使用内置主题模板：

```css
@import "@workbench-kit/vue-workbench/theme/midnight.css";
@import "tailwindcss";
@import "tailwindcss-safe-area";
@import "@workbench-kit/vue-workbench/style.css";
```

如果本包以源码包形式位于业务源码目录之外，还需要把包源码加入 Tailwind source：

```css
@source "../../../vendor/workbench-kit/packages/vue-file-workspace/src";
```

如果包来自 `node_modules`，路径通常类似：

```css
@source "../node_modules/@workbench-kit/vue-file-workspace";
```

路径以当前 CSS 文件位置为准。

## 入口

```ts
import {
  FileTree,
  type FileWorkspaceClient,
  type LocalFileItem,
  type LocalFileListResult,
  type LocalFilePreview
} from "@workbench-kit/vue-file-workspace";
```

## Client adapter

业务项目适配自己的文件 API：

```ts
import type { FileWorkspaceClient } from "@workbench-kit/vue-file-workspace";

export const fileApi: FileWorkspaceClient = {
  async listItems(path) {
    return requestJson(`/api/workspace/files?path=${encodeURIComponent(path)}`);
  },
  async readFile(path, range) {
    const params = new URLSearchParams({ path });
    if (range?.startLine !== undefined) params.set("startLine", String(range.startLine));
    if (range?.endLine !== undefined) params.set("endLine", String(range.endLine));
    return requestJson(`/api/workspace/file?${params.toString()}`);
  },
  getContentUrl(path) {
    return `/api/workspace/content?path=${encodeURIComponent(path)}`;
  }
};
```

`listItems(path)` 返回：

```ts
{
  root: "/workspace",
  path: "src",
  items: [
    {
      path: "src/index.ts",
      name: "index.ts",
      kind: "file",
      sizeBytes: 1024,
      updatedAtMs: 1730000000000
    }
  ]
}
```

`readFile(path, range)` 返回文本预览：

```ts
{
  path: "src/index.ts",
  content: "console.log('hello');",
  startLine: 1,
  endLine: 1,
  totalLines: 1,
  truncated: false
}
```

## 渲染 FileTree

`FileTree` 只渲染树，不自己请求数据。业务页面负责维护：

- 根目录 `items`
- 已展开目录 `expandedPaths`
- 目录子项缓存 `itemsByPath`
- 当前选中项 `selectedPath`
- 展开/收起目录逻辑
- 文件预览逻辑

需要 checkbox 多选时，将 `selectionMode` 设为 `multiple`，并传入受控的
`selectedPaths` 与 `indeterminatePaths`。组件通过
`toggleSelection(item, selected)` 报告切换意图；目录级联、半选状态计算和
未加载子目录的数据获取仍由业务项目负责。未设置 `selectionMode` 时继续使用
原有的 `selectedPath` / `selectItem` 单选协议。

示例：

```vue
<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { FileTree, type LocalFileItem } from "@workbench-kit/vue-file-workspace";
import { fileApi } from "../api/workspace";

const rootItems = ref<LocalFileItem[]>([]);
const expandedPaths = ref<string[]>([]);
const itemsByPath = reactive<Record<string, LocalFileItem[]>>({});
const selectedPath = ref<string | null>(null);

async function loadPath(path: string) {
  const result = await fileApi.listItems(path);
  if (path === "") {
    rootItems.value = result.items;
  } else {
    itemsByPath[path] = result.items;
  }
}

async function toggleDirectory(path: string) {
  if (expandedPaths.value.includes(path)) {
    expandedPaths.value = expandedPaths.value.filter((item) => item !== path);
    return;
  }
  expandedPaths.value = [...expandedPaths.value, path];
  if (!itemsByPath[path]) {
    await loadPath(path);
  }
}

function selectItem(item: LocalFileItem) {
  selectedPath.value = item.path;
  if (item.kind === "directory") {
    void toggleDirectory(item.path);
  }
}

onMounted(() => {
  void loadPath("");
});
</script>

<template>
  <FileTree
    :items="rootItems"
    :expanded-paths="expandedPaths"
    :items-by-path="itemsByPath"
    :selected-path="selectedPath"
    @toggle-directory="toggleDirectory"
    @select-item="selectItem"
  />
</template>
```

## 职责边界

本包负责：

- 文件树视觉结构。
- 文件/目录图标。
- 目录展开状态的事件协议。
- 文件列表、文件预览和 client 类型。

业务项目负责：

- 文件 API。
- 路径权限和安全过滤。
- 文件预览器。
- 图片、二进制、媒体文件展示。
- 上传、删除、重命名等写操作。

## 响应式列表与文件操作

`FileEntryList` 接收结构化 `FileWorkspaceEntry`，使用 `setSelection`、`focusEntry`、`openEntry`、`entryAction` 事件交给业务维护状态。支持容器宽度驱动的双行紧凑布局、桌面虚拟列表/网格、范围选择、快速输入定位、框选与列宽调整。`thumbnail`、`actions`、`entry-meta`、`selection-actions` 插槽用于注入缩略图和业务动作。触摸单击打开，鼠标单击选择、双击打开；紧凑模式的“选择”入口启用显式多选。拖放默认关闭，调用方通过可选 `draggable`、`dropEnabled` 和事件接入。

`FileLocationPicker` 的 `FileLocationClient` 只负责目录列表；root、可选位置、禁用原因均由业务提供。支持 AbortSignal、分页、加载失败重试及返回历史。`FileOperationPanel` 和 `FileConflictPanel` 是可嵌入 runtime window 的内容组件，不创建自己的弹窗，也不执行后端操作。

`FileOperationsAdapter` 独立于现有 `FileWorkspaceClient`，可选用于上传、复制、移动、删除。共享包只定义请求/任务/冲突契约；API 路径、认证、root 配置、执行与权限不属于本包。

`useFilePicker().pick({directory:true})` 在支持 File System Access 的安全上下文浏览器中保留空目录；其它浏览器退回 `webkitdirectory`，该浏览器接口只返回文件，无法保留空目录。`readFileDrop` 使用目录 entry 递归读取并保留空目录。所有上传路径统一为相对路径，拒绝绝对路径和 `..`。

`useFileClipboard` 每次调用独立，工作区需要共享剪贴板时在上层提供同一个实例。复制/剪切保存来源与条目快照；剪切成功后由业务调用 `clear()`，失败保留。内部拖放用 `writeFileDrag`，外部拖放和内部拖放通过 `useFileDrop` 区分；默认 copy，消费者可用 `dropEffect` 回调基于目标位置决定 move/copy/none。

列表列宽默认不写入浏览器存储；可选 `storageKey` 持久化列宽，读取时校验数值类型并限制在列的有效范围。`FileLocationPicker` 默认显示选择按钮；在 runtime window 已提供外部确认动作时，传 `showSelectButton=false` 并监听 `update:modelValue`，将浏览位置写入窗口的临时 values，最终确认由宿主完成。`FileOperationPanel` 使用该模式实时更新 `request.target`，最终操作只需一次确认。
