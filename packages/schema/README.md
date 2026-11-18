# @workbench-kit/schema

通过 `file:vendor/workbench-kit/packages/schema` 引用此源码包。服务端可直接使用 `planSettingsActivation(schema, startup, published)`，Vue 项目也可以从 `@workbench-kit/vue` 导入同一能力。

schema 节点的 `activation` 缺省或为 `"live"` 时应用已发布值。设为 `"restart"` 时，节点有变化便保留启动值，并在 `restartRequiredPaths` 中记录路径。路径用字符串数组表示，空数组表示根节点。

现有对象的字段和记录的稳定键分别生效。数组、联合分支和出现或消失的复合对象作为整体生效，含有重启节点时整个边界保留启动值。校验和默认值解析由宿主完成。两个输入应是对应 schema 已解析的 JSON 树，结果可能复用输入中的值，调用方将其视为只读。

页面可从聚合入口调用 `settingsActivationMessage(snapshot)`，按运行态和字段路径生成状态文案。保存及发布的时机由宿主管理。
