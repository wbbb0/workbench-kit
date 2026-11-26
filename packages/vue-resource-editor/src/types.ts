import type {
  ActivationPolicy,
  DurationTimescale,
  ObjectFieldMeta,
  ObjectVariantMeta,
  SchemaMeta,
  SchemaPreview,
} from "@workbench-kit/schema";

export type {
  ActivationPolicy,
  DurationTimescale,
  ObjectFieldMeta,
  ObjectVariantMeta,
  SchemaMeta,
  SchemaPreview,
};

/** Resource list 中的一条资源摘要。 */
export interface EditorResourceSummary {
  /** 资源稳定 key，用于 load/validate/save。 */
  key: string;
  title: string;
  /** 资源域。业务项目可用 domain 过滤不同资源列表。 */
  domain: "config" | "data";
  /** single 表示单文件资源，layered 表示多层覆盖资源。 */
  kind: "single" | "layered";
  /** false 时 UI 应禁止保存。 */
  editable: boolean;
}

export interface UiVariantBranch {
  title?: string;
  description?: string;
  disabled?: boolean;
  children?: Record<string, { field: ObjectFieldMeta; node: UiNode }>;
}

/** SchemaNode 使用的递归 UI 树。 */
export type UiNode =
  | { kind: "field"; schema: SchemaMeta }
  | {
      kind: "group";
      schema: SchemaMeta;
      children: Record<string, { field: ObjectFieldMeta; node: UiNode }>;
      variants?: Record<string, UiVariantBranch>;
    }
  | { kind: "array"; schema: SchemaMeta; item: UiNode }
  | { kind: "record"; schema: SchemaMeta; key: UiNode; value: UiNode }
  | { kind: "union"; schema: SchemaMeta; options: UiNode[] };

function mapFields(
  fields: Record<string, ObjectFieldMeta> | undefined,
): Record<string, { field: ObjectFieldMeta; node: UiNode }> {
  return Object.fromEntries(
    Object.entries(fields ?? {}).map(([key, field]) => [
      key,
      { field, node: buildUiTree(field.schema) },
    ]),
  );
}

/** 从 SchemaMeta 构造供 SchemaNode 使用的递归 UI 树。 */
export function buildUiTree(schema: SchemaMeta): UiNode {
  if (schema.kind === "object") {
    const variants = schema.variants
      ? Object.fromEntries(
          Object.entries(schema.variants).map(([key, variant]) => [
            key,
            {
              ...(variant.title !== undefined ? { title: variant.title } : {}),
              ...(variant.description !== undefined
                ? { description: variant.description }
                : {}),
              ...(variant.disabled !== undefined
                ? { disabled: variant.disabled }
                : {}),
              ...(variant.fields !== undefined
                ? { children: mapFields(variant.fields) }
                : {}),
            },
          ]),
        )
      : undefined;
    return {
      kind: "group",
      schema,
      children: mapFields(schema.fields),
      ...(variants ? { variants } : {}),
    };
  }
  if (schema.kind === "array" && schema.item) {
    return { kind: "array", schema, item: buildUiTree(schema.item) };
  }
  if (schema.kind === "record" && schema.recordValue) {
    return {
      kind: "record",
      schema,
      key: {
        kind: "field",
        schema: schema.key ?? { kind: "string", optional: false, hasDefault: false },
      },
      value: buildUiTree(schema.recordValue),
    };
  }
  if (schema.kind === "union" && schema.options) {
    return {
      kind: "union",
      schema,
      options: schema.options.map(buildUiTree),
    };
  }
  return { kind: "field", schema };
}

/** 由消费方注入的节点操作；组件库不解释业务路径与行为。 */
export interface EditorNodeAction {
  key: string;
  icon:
    | "trash"
    | "up"
    | "down"
    | "pencil"
    | "check"
    | "restore"
    | "copy"
    | "play";
  title: string;
  label?: string;
  disabled?: boolean;
  danger?: boolean;
  submitEdit?: boolean;
  onClick: () => void;
}

export interface EditorNodeActionContext {
  node: UiNode;
  path: Array<string | number>;
  value: unknown;
}
export type EditorNodeActions = (
  context: EditorNodeActionContext,
) => EditorNodeAction[];

/** 动态分组选项中的一个可选值。key 只用于选择器身份，value 是最终写回草稿的完整值。 */
export interface EditorOption {
  key: string;
  label: string;
  value: unknown;
  description?: string;
  disabled?: boolean;
}

/** 动态选项分组。group key 与 option key 都应在各自层级内稳定且唯一。 */
export interface EditorOptionGroup {
  key: string;
  label: string;
  options: EditorOption[];
}

export type EditorOptionsResult =
  | { options: string[] }
  | { groups: EditorOptionGroup[] };

/** record 节点显式结构变更通知，供调用方处理跨资源联动。 */
export type EditorRecordMutationEvent =
  | {
      kind: "rename";
      path: Array<string | number>;
      key: string;
      nextKey: string;
    }
  | { kind: "remove"; path: Array<string | number>; key: string }
  | { kind: "add"; path: Array<string | number> };

/** layered 资源中的一层。 */
export interface LayerInfo {
  key: string;
  path: string;
  value: unknown;
}

/** 草稿最终值计算模式。 */
export type EditorDraftEffectiveMode =
  | "draft_only"
  | "merge_reference"
  | "record_inheritance";

/** unset 操作展示和行为模式。 */
export type EditorUnsetMode = "disabled" | "optional" | "reference";

/** 编辑器功能开关。业务后端按资源类型返回，前端只按契约渲染。 */
export interface EditorFeatures {
  /** 按判别字段隔离专属参数；外层策略仍按普通继承规则合并。 */
  variantInheritance?: Array<{
    path: string[];
    discriminator: string;
    settingsKey: string;
    defaultVariant: string;
    defaults: Record<string, unknown>;
  }>;
  showReferenceBackdrop: boolean;
  unsetMode: EditorUnsetMode;
  unsetActionLabel: string | null;
  draftEffectiveMode: EditorDraftEffectiveMode;
  /** 新增集合项及普通 union 切换使用 Schema 默认值；默认关闭，保留原有清空行为。 */
  initializeFromDefaults?: boolean;
  recordInheritance?: { sourceKey: string; defaults: Record<string, unknown> };
}

interface BaseEditorModel {
  /** 与 EditorResourceSummary.key 对齐。 */
  key: string;
  title: string;
  editable: boolean;
  schemaMeta: SchemaMeta;
  uiTree: UiNode;
  template: unknown;
  schemaDefaultValue: unknown;
  currentValue: unknown;
  referenceValue: unknown;
  effectiveValue: unknown;
  editorFeatures: EditorFeatures;
}

/** 单文件资源模型。 */
export interface SingleEditorModel extends BaseEditorModel {
  kind: "single";
  file: { path: string };
}

/** 多层覆盖资源模型。 */
export interface LayeredEditorModel extends BaseEditorModel {
  kind: "layered";
  writableLayerKey: string;
  layers: LayerInfo[];
}

export type EditorModel = SingleEditorModel | LayeredEditorModel;

/** validate 成功结果。失败应由 client 抛出 Error。 */
export type ResourceEditorValidateResult = {
  ok: true;
  parsed: unknown;
  currentValue: unknown;
  referenceValue: unknown;
  effective: unknown;
};

/** save 成功结果。失败应由 client 抛出 Error。 */
export type ResourceEditorSaveResult = {
  ok: true;
  path: string;
  parsed: unknown;
};

/** 业务项目需要实现的资源编辑 API adapter。 */
export interface ResourceEditorClient {
  /** 列出可编辑或可查看资源。 */
  list(): Promise<{ resources: EditorResourceSummary[] }>;
  /** 加载单个资源的完整 editor model。 */
  load(key: string): Promise<{ editor: EditorModel }>;
  /** 校验草稿值。失败时抛出带用户可读 message 的 Error。 */
  validate(key: string, value: unknown): Promise<ResourceEditorValidateResult>;
  /** 保存草稿值。失败时抛出带用户可读 message 的 Error。 */
  save(key: string, value: unknown): Promise<ResourceEditorSaveResult>;
  /** 可选动态选项接口，供业务项目扩展字段选择器。 */
  options?(key: string): Promise<EditorOptionsResult>;
}
