# AGENTS.md

## 项目定位

`workbench-kit` 是个人项目使用的 Vue 3 workbench 源码包集合，不发布到 npm registry，默认通过 git submodule 和 `file:` 依赖被业务项目消费。

## 包边界

- `packages/vue`：推荐给业务项目使用的聚合入口，统一导出 Vue workbench、resource editor、file workspace、runtime 和 CSS 入口。
- `packages/vue-workbench`：工作台外壳、导航、菜单、toast、窗口、通用 primitives、主题模板和基础样式。
- `packages/vue-resource-editor`：schema 驱动资源编辑器能力，只包含通用类型、状态和组件。
- `packages/vue-file-workspace`：通用文件树和文件工作区类型契约。

## 开发约束

- 默认使用中文沟通和写说明文档。
- 优先维护 `@workbench-kit/vue` 聚合入口，简单业务项目不应被迫分别依赖多个底层包。
- 底层包仍应保持可独立引用，但不要让业务项目必须直接使用底层包才能完成常规接入。
- 不要引入 llm-onebot 或其他业务项目的 API、路由、store、资源名称、会话语义或后端协议。
- 能通过 props、事件、composable、client adapter 注入的能力可以进入共享包；必须知道具体业务字段或接口路径的逻辑留在业务项目。
- 主题模板放在 `packages/vue-workbench/src/themes/`，并通过 `packages/vue` 聚合入口暴露；业务项目应能选择模板、局部 override，或完全自定义 token。
- CSS/Tailwind 接入应尽量保持单入口；常规项目优先导入 `@workbench-kit/vue/style.css`，避免要求业务项目手写多个 `@source`。
- `WorkbenchRuntimeRoot` 是 controller、menu、toast、window host 的共享 runtime 根。需要 `useWorkbenchWindows()`、toast 或菜单服务的页面必须挂在它或其包装 root 下。
- `WorkbenchRoot` 是复杂类 VSCode 工作台 shell，适合 mizune-core 这类多区域、多窗口、多菜单应用；不要把它用于普通网页布局。
- `WorkbenchPageRoot` 是普通 Nuxt/Vue 管理页的轻量 root，负责主题背景、header、内部滚动容器和 runtime host。简单后台页优先用它，再组合 `WorkbenchCardStack`、`WorkbenchFeatureCard`、`WorkbenchDialog` 等组件。
- 窗口移动、缩放、最大化和边界限制的唯一实现应是 `windows/WindowSurface.vue`。不要在 `WorkbenchDialog`、业务项目弹窗或其它 primitive 里复制 pointer move/resize 逻辑；需要移动/缩放时使用 `useWorkbenchWindows().openDialog()` 并传 `movable`/`resizable`。
- `WorkbenchDialog` 是固定位置的兼容弹窗 primitive，保持简单 `v-model` 接口，不承载 runtime window 能力。
- `WorkbenchLoginPage` 是可复用登录 UI，不包含 API、路由、session、跳转或权限语义；业务项目通过受控 props 和 `submit`/`passkey` 事件接入自己的认证逻辑。
- `@workbench-kit/vue/style.css` 会设置 `html, body, #app, #__nuxt { height: 100%; overflow: hidden; }`。消费项目必须由 shell 或页面 layout 提供内部滚动容器，例如 `h-dvh flex flex-col overflow-hidden` 加 `main.scrollbar-thin.flex-1.overflow-auto`。
- 修改组件、CSS 入口或导出契约后，至少运行 `npm run typecheck`。

## Git 工作流

- 本仓库可以在业务项目的 `vendor/workbench-kit` submodule 内直接修改。
- 修改完成后先在本仓库提交并推送，再回到业务项目提交 submodule 指针更新。
- 公开仓库地址当前为 `https://github.com/wbbb0/workbench-kit`。
