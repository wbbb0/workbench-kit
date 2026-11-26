# @workbench-kit/vue-workbench

Vue 3 工作台外壳包，提供桌面/移动端布局、导航、菜单、toast、窗口、基础 primitives 和 workbench 基础样式。

这个包只负责通用工作台能力，不依赖业务项目的 router、store、API adapter 或具体 section。业务项目通过 props、类型契约和 composable 把自己的页面接入 workbench。

## 依赖

业务项目需要提供 peer dependencies：

```bash
npm install vue lucide-vue-next
```

推荐通过 `workbench-kit` submodule 和 `file:` 依赖使用：

```json
{
  "dependencies": {
    "@workbench-kit/vue-workbench": "file:../vendor/workbench-kit/packages/vue-workbench"
  }
}
```

完整接入方式见仓库根目录的 `docs/usage.md`。

## 导航位置

`WorkbenchNavItem.placement` 在两种布局中含义一致：桌面将 `primary` 放主区域、`bottom` 放底部；移动标题栏按 `primary → bottom` 排列。同组内保留传入顺序，不修改原数组。设置等辅助入口只需标为 `bottom`，消费项目无需为手机另外排序。工作台菜单是独立的外壳入口，不属于业务导航项。

## 样式接入

业务项目可以直接选择内置主题模板，再引入 Tailwind 和 workbench 基础样式：

```css
@import "@workbench-kit/vue-workbench/theme/midnight.css";
@import "./theme-overrides.css";
@import "tailwindcss";
@import "tailwindcss-safe-area";
@import "@workbench-kit/vue-workbench/style.css";
```

`theme-overrides.css` 是项目侧可选覆盖文件。简单项目可以不写覆盖；需要微调时，只覆盖少量变量即可：

```css
:root,
html[data-theme="dark"] {
  --accent: #2dd4bf;
  --accent-hover: #5eead4;
}
```

如果项目完全自定义主题，则需要提供这些 token：

```css
:root,
html[data-theme="dark"] {
  --surface-app: #0b1220;
  --surface-sidebar: #101827;
  --surface-panel: #121c2d;
  --surface-input: #182335;
  --surface-muted: #1a2537;
  --surface-hover: #172338;
  --surface-active: #21314a;
  --surface-selected: #16365f;
  --surface-selected-muted: #15253d;

  --border-subtle: color-mix(in srgb, #31415c 64%, transparent);
  --border-default: #2b3a54;
  --border-strong: #41526f;
  --border-focus: #4ea3ff;
  --border-input: #31415c;

  --text-primary: #d6deea;
  --text-secondary: #f2f6fd;
  --text-muted: #93a3bd;
  --text-subtle: #677891;
  --text-accent: #83c4ff;
  --text-on-accent: #ffffff;

  --accent: #3f9cff;
  --accent-hover: #5caeff;
  --success: #47c59d;
  --warning: #e5ba62;
  --danger: #f26d7d;
  --info: #72c6ff;

  --surface-success: color-mix(in srgb, var(--success) 18%, var(--surface-panel));
  --surface-warning: color-mix(in srgb, var(--warning) 16%, var(--surface-panel));
  --surface-danger: color-mix(in srgb, var(--danger) 14%, var(--surface-panel));
  --surface-info: color-mix(in srgb, var(--info) 14%, var(--surface-panel));

  --scrollbar-bg: transparent;
  --scrollbar-thumb: #33445f;
  --scrollbar-thumb-hover: #415674;

  --activity-bar-width: 48px;
  --font-size-ui: 13px;
  --font-size-small: 11px;
  --font-size-mono: 12px;
  --line-height-ui: 1.4;
  --font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-mono: "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;
}
```

`style.css` 会把这些 token 映射成 Tailwind v4 theme token，例如 `bg-surface-panel`、`border-border-default`、`text-text-muted`、`text-ui`、`font-ui`。

## Tailwind source

Tailwind v4 只会为扫描到的 class 生成 CSS。源码包位于业务项目源码目录之外时，必须在 CSS 入口声明 source：

```css
@source "../../../vendor/workbench-kit/packages/vue-workbench/src";
```

路径以当前 CSS 文件位置为准。以 `webui/src/style/main.css` 为例，`vendor/workbench-kit` 位于项目根目录时使用 `../../../vendor/workbench-kit/packages/vue-workbench/src`。

如果包来自 `node_modules`，路径通常类似：

```css
@source "../node_modules/@workbench-kit/vue-workbench";
```

缺少 `@source` 时，包内组件的 utility 不会生成，常见表现包括 activity bar 宽度、安全区 padding、伪元素和颜色类失效，例如：

- `pl-safe`
- `w-[calc(var(--activity-bar-width)+env(safe-area-inset-left))]`
- `h-(--activity-bar-width)`
- `bg-surface-sidebar`
- `text-text-muted`
- `before:bg-text-secondary`

## 入口

常规组件入口：

```ts
import {
  WorkbenchRoot,
  defineWorkbenchView,
  useWorkbenchNavigation,
  useWorkbenchToasts,
  useWorkbenchWindows,
  WorkbenchAreaHeader,
  WorkbenchCard,
  WorkbenchDisclosure,
  WorkbenchEmptyState,
  WorkbenchListItem,
  TreeNodeShell
} from "@workbench-kit/vue-workbench";
```

纯运行时或测试场景使用子入口，避免加载 `.vue` 组件：

```ts
import {
  createWindowManager,
  resolveWindowSizing
} from "@workbench-kit/vue-workbench/runtime";
```

## 挂载 WorkbenchRoot

业务项目负责选择当前 view、传入导航项和处理导航行为：

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { MessageSquare } from "lucide-vue-next";
import { WorkbenchRoot, defineWorkbenchView } from "@workbench-kit/vue-workbench";
import SessionsListPane from "./sections/sessions/SessionsListPane.vue";
import SessionsMainPane from "./sections/sessions/SessionsMainPane.vue";

const router = useRouter();

const sessionsView = defineWorkbenchView({
  id: "sessions",
  title: "Sessions",
  areas: {
    primarySidebar: SessionsListPane,
    mainArea: SessionsMainPane
  },
  layout: {
    mobile: {
      rootArea: "primarySidebar"
    },
    desktop: {
      primarySidebar: {
        defaultSizePx: 280,
        minSizePx: 220,
        maxSizePx: 520
      }
    }
  }
});

const activeView = computed(() => sessionsView);
const navItems = [
  {
    id: "sessions",
    title: "Sessions",
    icon: MessageSquare,
    placement: "primary" as const
  }
];
</script>

<template>
  <WorkbenchRoot
    :view="activeView"
    :nav-items="navItems"
    active-nav-item-id="sessions"
    :topbar-menus="[]"
    :statusbar-items="[]"
    :is-mobile="false"
    @navigate="(itemId) => router.push({ name: itemId })"
  />
</template>
```

`WorkbenchRoot` 会创建 controller，并挂载 `WorkbenchShell`、`MenuHost`、`ToastViewport` 和 `WindowHost`。业务项目通常不需要直接挂载这些内部 host。

`WorkbenchRoot` 和 `WorkbenchShell` 提供可选的 `hideEmptyTopbar`（默认 `true`），在桌面端 `topbarMenus` 为空时隐藏顶栏（同时保留顶部安全区内边距）；需要始终显示空顶栏时可显式传入 `:hide-empty-topbar="false"`。移动端顶栏仍会显示页面标题与工作台菜单。

## View contract

每个 view 至少包含 `id`、`title` 和 `areas.mainArea`：

```ts
defineWorkbenchView({
  id: "config",
  title: "Config",
  areas: {
    mainArea: ConfigMainPane
  }
});
```

可选区域：

- `primarySidebar`
- `secondarySidebar`
- `bottomPanel`
- `mobileHeader`

可选布局：

```ts
layout: {
  mobile: {
    rootArea: "primarySidebar"
  },
  desktop: {
    primarySidebar: {
      defaultSizePx: 280,
      minSizePx: 220,
      maxSizePx: 520
    },
    secondarySidebar: {
      defaultSizePx: 320
    },
    bottomPanel: {
      defaultSizePx: 240,
      minSizePx: 120
    }
  }
}
```

桌面 pane 尺寸由 workbench runtime 统一维护并写入 `localStorage`，section 不应自己保存 pane 宽高。

## Runtime composables

在 `WorkbenchRoot` 挂载后，section 和普通组件可以使用：

```ts
import {
  useWorkbenchNavigation,
  useWorkbenchToasts,
  useWorkbenchWindows
} from "@workbench-kit/vue-workbench";

const navigation = useWorkbenchNavigation();
const toast = useWorkbenchToasts();
const windows = useWorkbenchWindows();

navigation.showArea("mainArea");
toast.push({ type: "success", message: "已保存" });

const result = await windows.openDialog({
  title: "创建会话",
  size: "sm",
  schema: {
    fields: [
      {
        kind: "string",
        key: "title",
        label: "标题",
        required: true
      }
    ]
  },
  actions: [
    {
      id: "create",
      label: "创建",
      variant: "primary",
      run: ({ values }) => values
    }
  ]
});
```

这些 composable 依赖 runtime controller。请挂载 `WorkbenchRuntimeRoot` 或包含它的 `WorkbenchRoot` / `WorkbenchPageRoot`；窗口组件绑定所属 runtime，组件外调用使用当前 active controller。

runtime 窗口支持 `showCloseButton`、`showMaximizeButton`、`movable`、`resizable`、`mobileFullscreen` 与 footer actions。`showMaximizeButton` 默认关闭，开启后桌面端显示最大化／还原按钮，与标题栏双击共用尺寸逻辑。模态窗口可开启 `trapFocus`，将键盘焦点保持在活动窗口中；宿主负责关闭后的焦点恢复和页面离开时释放窗口。

## 顶部菜单和状态栏

顶部菜单由结构化 `MenuNode[]` 描述：

```ts
import type { WorkbenchTopbarMenu } from "@workbench-kit/vue-workbench";

const topbarMenus: WorkbenchTopbarMenu[] = [
  {
    id: "view",
    label: "视图",
    resolveItems: () => [
      {
        kind: "action",
        id: "reload",
        label: "重新加载",
        onSelect: () => reload()
      },
      {
        kind: "separator",
        id: "sep-1"
      }
    ]
  }
];
```

状态栏项以组件形式传入：

```ts
import type { WorkbenchStatusbarItem } from "@workbench-kit/vue-workbench";

const statusbarItems: WorkbenchStatusbarItem[] = [
  {
    id: "backend",
    component: BackendStatusChip,
    props: {
      backendId: activeBackendId.value
    }
  }
];
```

## Public primitives

- `TreeNodeShell`
- `WorkbenchAreaHeader`
- `WorkbenchCard`
- `WorkbenchDisclosure`
- `WorkbenchEmptyState`
- `WorkbenchListItem`

这些组件只承担稳定视觉结构，不绑定业务数据。


## 区域页面缓存与通用消息窗口

`defineWorkbenchView` 可选 `cache: { areas: ["mainArea", "primarySidebar"], max: 8 }`。
缓存位于实际区域 renderer，key 仅由 `view.id` 与 `areaId` 组成。未配置时保持原有卸载行为；移动端隐藏详情区域会 deactivated。
这只保留组件实例；重要的编辑缓冲、阅读锚点应由宿主状态持有，以便缓存淘汰、响应式布局重挂后恢复。

聚合入口 `@workbench-kit/vue` 导出 `MessageWindow`、`MessageTimeline`、`MessageContent`、`MessageComposer` 和 `useMessageViewport`。
它们只接受通用 `MessageItem` / `MessagePart`、受控草稿文本与阅读锚点，并发出 submit / selection / older / newer / anchor / detail / reference 事件；不请求业务 API、不解析业务 ID、不管理消息队列。
`MessageTimeline` 使用正向可变高度虚拟清单；宿主提供连续有界消息区间、分页游标对应的布尔标记及可选 `unseen` 数量。
`active` 默认 true；隐藏时不滚动、不观察尺寸。Markdown 默认禁用原始 HTML，代码可复制，长代码可展开，图片不可用时保留说明。
样式仍通过原有 `@workbench-kit/vue/style.css` 单入口提供。

### 紧凑工具栏按钮

`WorkbenchButton` 的可选 `size="sm"` 使用 28px 高度，纯图标按钮宽度也为 28px，适用于 36px 工具栏。默认尺寸与既有行为保持不变。`WorkbenchIconButton` 将自身 `size` 传递给底层按钮；`variant="secondary"` 使用主题的边框外观。

### 消息与窗口可选展示

MessageComposer 新增 layout="inline"、attachmentButton 和 attachment(MouseEvent)；inputLabel、placeholder、submitLabel 可定制用途，宿主提供附件菜单。默认 stacked 布局保留。MessageItem.identity 可提供 icon 和 accent/muted tone，时间线显示侧边图标并将作者转为可访问提示；未传入仍使用标题。MessageContent.compact 只移除首尾段落外边距。

runtime dialog 可设 showFooterCloseButton=false，隐藏底部关闭按钮并保留业务 actions；footer="auto" 且没有动作时不显示空 footer。默认仍保留底部关闭，供没有顶部入口的消费者使用。

MessageComposer 可选 flush 模式去掉 form 外侧 padding 和内部容器边框，保留最大宽度与水平居中；默认外观不变。


MessageTimeline 的 heading/activity 记录共用折叠头部，分别默认展开/收起；expandedRecords 可注入按记录 ID 的 Map，跨虚拟化及页面挂载保存用户选择。折叠切换退出贴底，由虚拟列表负责行高与阅读位置校正；上层不逐行观察、不在行高变化时恢复旧锚点，只观察视口和总内容尺寸以跟随最新。显式锚点恢复仅用于初始化、切页、跳转和历史窗口变化。离开底部后退出跟随，实际回到底部才恢复。完整详情使用独立按钮。MessageItem.metrics 接受已格式化 label/value/title 清单，位于展开区底部；kit 不计算供应商用量或业务聚合。

页面标签可用 `WorkbenchTabStrip.rowHeight` 指定含边框的 CSS 高度（例如主题变量），用 `equalWidth` 均分标签。省略时沿用原尺寸与分布。消息时间线可用 `MessageItem.detailLabel` 指定详情操作的可访问名称。

组件中使用 `useScopedDialog(defaults)` 可持有一个活动窗口。再次 open 会替换旧窗口，组件停用或卸载时关闭，用户关闭后焦点回到仍挂载的触发元素。外观与业务按钮由 defaults 和本次 open 的参数决定。
