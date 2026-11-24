# 通用页面层级导航

状态：已实现于当前工作副本，尚未提交。核对日期：2026-11-17。

本文说明 WorkbenchRoot 的通用页面层级能力。受控导航已导出；未接入的消费者继续使用原有区域栈。SchemaSettingsPage 可通过可选属性关闭自带导航。

## 目标与当前问题

让同一工作台区域能够显示任意深度的页面，并由移动外壳的顶部按钮统一返回。桌面继续使用侧栏与主区域并排布局，页面无需自行判断当前属于第几级、何时返回侧栏。

此前 MobileWorkbench 通过 mobileAreaStack 在侧栏、主区域等区域之间切换，showArea(mainArea) 每次重建为“根区域 → 主区域”，无法表达主区域中的更深页面。detailKey 也没有定义父级和标题语义。MobileWorkbench 还会自行 pushState、监听 popstate；宿主同时使用路由时，会有两处管理浏览器历史。

新增能力采用可选的受控页面导航：提供当前页面的祖先链和导航回调，kit 派生标题、返回目标和移动区域。祖先链表示结构，不是点击历史；不新增与宿主路由并行的 pageStack。

## 最小公开契约

通过 WorkbenchRoot 的可选 pageNavigation 属性接入，并向 runtime 传递；由 @workbench-kit/vue 聚合入口导出类型与 composable。

```ts
interface WorkbenchPageLocation {
  key: string;
  title: string;
  areaId: WorkbenchAreaId;
}

interface WorkbenchPageNavigation {
  viewId: string;
  path: readonly WorkbenchPageLocation[];
  navigate(
    target: WorkbenchPageLocation,
    options: { replace: boolean },
  ): Promise<boolean> | boolean;
}
```

- path 是非空的“入口 → 祖先 → 当前页面”链，最后一项为当前页面。key 在 view 内唯一且稳定，title 可随数据更新；多个连续页面允许属于同一个 areaId。
- viewId 必须对应当前 view；areaId 必须是该 view 支持的区域。组件库不解析 key，不从 URL、字段名或标题猜测层级。
- navigate 成功返回 true，取消返回 false，失败可抛错。宿主更新受控 path；kit 不先改一个本地镜像。Promise 完成只表示请求结果，界面仍以受控输入为准。
- 扩展 useWorkbenchNavigation，提供 openPage(target, options)、backPage()、当前页面与 canGoBack。backPage 从当前链取倒数第二项；根页无动作。现有 showArea/showRootArea/popArea 不改签名，继续用于未接入页面导航的消费方。
- 受控模式的页面调用新入口，不混用旧区域写入 API。旧 API 在受控模式不得修改另一份区域栈；调用时提示不正确接入。类型与文档明确两种模式，避免静默失配。
- composable 优先绑定注入的 runtime 和调用所在 view，而非让回调运行时重新选择全局活动工作台。已停用 view 的迟到回调不能改动当前 view；异步请求期间避免重复返回，切 view 后旧请求不恢复旧界面。

这不是路由注册表或页面渲染引擎。区域仍通过现有 areas 提供组件；同一个组件可按 key/宿主状态显示不同内容。无需给每一层配置一个组件或创建一个 KeepAlive 实例。

## 桌面与移动展示

以“分类列表 → 分类详情 → 条目 → 子项”为例，根节点位于 primarySidebar，之后的节点均可位于 mainArea。

| 场景 | 行为 |
| --- | --- |
| 桌面 | 左侧分类常驻，主区域显示当前页面；正文不重复放返回箭头，深层页面可用现有 WorkbenchBreadcrumbs 跳转祖先 |
| 移动分类列表 | 显示根区域；无父页返回按钮 |
| 移动分类详情 | 顶部返回分类列表 |
| 移动条目、子项 | 顶部返回直接父页，仍在同一主区域渲染 |
| 直接打开深层链接 | 根据完整祖先链显示页面和父级，不要求先访问过父页 |
| 搜索跳转或切换分类 | 根据目标重算祖先链，不把此前浏览过的其他分类作为父级 |
| 桌面与移动互切 | 同一页面状态继续生效，仅改变布局，不写 URL 或新增历史记录 |

移动标题使用当前页面 title，按钮有明确的返回父页可访问名称。页面主体的搜索、工具栏与表单操作仍由页面提供。二级设置正文移除返回箭头；移动端无需在正文再放同样的导航。可折叠面包屑复用现有组件，不另造一套层级展示。

## 浏览器历史的单一归属

接入受控 pageNavigation 后，kit 不为该工作台 pushState，也不监听 popstate 来修改区域栈。宿主路由是唯一历史写入者；路由的后退、前进、深链接恢复通过响应式 path 自然驱动界面。

- 普通打开子页交给宿主导航，默认 replace=false。
- 顶部返回表示“到父页”，使用 replace=true。即使从外部直接打开深层页，也可以返回父级，不盲目 history.back() 离开应用。
- 浏览器返回表示“上一条访问记录”，由路由原有语义处理，可能跨分类或跨 view；它与顶部的父页返回不要求完全相同。
- 不为缺失父级补造浏览器历史，不根据历史深度猜父级，不增加历史去重管理器。
- 无路由的消费方可用普通 ref 保存当前页面并提供 navigate 回调；kit 同样不接管浏览器历史，不额外开发第二套内存路由器。
- 未传 pageNavigation 的现有消费者保留现有区域导航默认行为。本次新增功能不破坏其导出与默认行为。

一个使用路由的宿主应在工作台整体接入受控模式，让已有列表/详情页也映射成两级页面链。不要仅在某个页面里关闭 popstate，然后让同一外壳的其他 view 继续插入额外历史。

## 生命周期与缓存

页面链由外壳以上的宿主状态派生，不依赖正在显示的内容组件注册。移动侧栏隐藏、内容缓存停用时，仍可正确显示当前路径和处理返回；不需要收集各页面的返回回调。

延续按 view/area 缓存组件的边界，不按每个字段路径无限缓存组件。页面身份用于定位滚动位置与焦点，不等于缓存实例身份。移动/桌面布局切换若会更换组件实例，滚动位置应存于共享的页面状态，并在整个 view 销毁时释放。

表单缓冲、请求和草稿仍归消费方；导航不保存、不取消、不清空编辑。设置 renderer 已有按路径保存滚动位置的逻辑，应复用/调整其状态归属，不在宿主和 kit 各保存一份。首版不新增通用草稿系统、导航守卫、标签页或持久页面缓存。

## Schema 设置页面的接入边界

vue-resource-editor 负责 schema 相关语义：通过纯函数 resolveSettingsPage 从 schema、有效值和当前字段路径计算真实可导航的页面祖先及标题。沿用 settingsPages.ts 的 schema 解析；union 判别字段、普通叶子和不存在的条目不能机械地按字符串分段当成页面。搜索或错误定位可以落在包含目标字段的页面，再由 renderer 定位字段。

宿主只把这些页面映射为通用 location，并负责 location 与 URL 之间的编码。分类入口放在哪个区域由宿主决定；vue-workbench 不认识 schema，vue-resource-editor 不依赖具体路由。

SchemaSettingsPage 提供 showBackButton、showBreadcrumbs、showTitle，默认均为 true；嵌入工作台时按布局关闭重复导航，独立使用默认不变。focusPath 用于字段定位，pageState 可传入 createSettingsPageState() 创建的内存状态以跨布局重建保留滚动位置、搜索和条目名称输入。桌面面包屑消费同一祖先数据。无需让 renderer 直接依赖工作台的全局活动状态。

schema/数据未加载时保留请求目标，显示加载状态，不把暂时无法解析误判为不存在。加载成功后若目标确实被删除或分支切换失效，宿主根据 schema helper 的有效祖先结果 replace 到最近有效父页，并说明原因；重命名成功后 replace 到新条目。组件库导航核心不猜资源生命周期。

## 实现范围与验证

当前实现包含：公开受控契约、runtime 派生页面导航、移动顶部接入、受控模式禁用内部历史操作、schema 祖先 helper/可选按钮展示，以及聚合导出与文档。消费方完成自己的路由适配；不预建配置 DSL、嵌套路由引擎或其他尚无需求的页面系统。

验证至少覆盖：

1. 两级与多级链、同区域父子、跨区域返回、根页无返回、标题更新。
2. 深链接、刷新、跨分类搜索、浏览器后退/前进、顶部父页返回；每次路由导航无 kit 额外历史写入。
3. 桌面/移动互切、切 view 再恢复、未发送/未保存输入和滚动位置保留。
4. schema 加载中、条目删除/重命名、union 分支变化、无效路径的有效父级处理。
5. 异步导航拒绝/失败、重复点击、停用 view 迟到回调，不造成 URL 与展示区域失配。
6. 不传 pageNavigation 的旧用法、独立 SchemaSettingsPage、多个 runtime 相互隔离。

实现已通过 kit 与消费项目的类型检查、组件/路由测试和前端构建。隔离浏览器验证了桌面/手机导航、深链接、后退/前进、字段定位、无效路径、未保存输入及布局切换；未使用正式配置或会话。


## 层级分栏与移动过渡

`WorkbenchPageColumns` 接受受控祖先链及按页渲染的插槽。桌面按内容区宽度显示最近的祖先和当前页。移动外壳内使用单栏；同区域下钻由分栏容器处理。宿主负责历史、面包屑、表单和滚动状态。详细契约见 [自适应层级分栏](design/adaptive-page-columns.md)。

宿主为详情提供 `presentation` 时，手机的一级区域与详情区域使用双页转场。旧消费方缺少稳定的详情描述时，区域即时切换。进入时详情从右侧覆盖一级页；返回时详情在上层向右滑出，露出已经在下层的一级页。顶栏固定。离场页内部停用交互，外层继续遮挡被覆盖区域；露出的区域可继续操作。切视图或同层换支直接呈现；连续导航和宽度变化取消旧位移。支持减少动态效果。

外壳保留离开区域的原页面链到动画结束，通过 `useWorkbenchLeavingPath()` 向其后代提供。宿主可以在 `WorkbenchPageLocation.presentation` 中附上原页面的渲染参数。组件可通过 `useWorkbenchAreaPresentation()` 在同一个区域实例读取退场参数和活动状态。内容用原参数绘制退出画面，并在区域非活动时停止订阅和输入处理。区域缓存按既有的 view 和 area 上限管理，各缓存实例具有独立的呈现状态。宿主继续写入受控路由历史。旧的 `layout.mobile.pageMotion` 配置保留为废弃字段。

SchemaSettingsPage 的 showHeader 默认为 true；消费方合并工具栏时可关闭，并使用传入 pageState.query 驱动同一份搜索结果。独立使用方式保持不变。
