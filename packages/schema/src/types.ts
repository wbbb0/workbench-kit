/** Marker consumed by the runtime when applying a published configuration. */
export interface ActivationPolicy {
  activation?: "live" | "restart";
}

export type DurationTimescale = "ms" | "s" | "min" | "h" | "d";

export type SchemaPreview =
  | string
  | {
      ref: string[];
      format?: "value" | "label" | "count";
      fallback?: string;
    }
  | { join: string; parts: SchemaPreview[] }
  | { tpl: SchemaPreview[]; all?: boolean };

export interface ObjectVariantMeta {
  title?: string;
  description?: string;
  disabled?: boolean;
  fields?: Record<string, ObjectFieldMeta>;
  preview?: SchemaPreview;
}

/** 后端 schema 转换后的元数据。SchemaNode / SchemaSettingsPage / SchemaSectionForm 依赖它渲染字段和默认值提示。 */
export interface ObjectFieldMeta {
  title?: string;
  description?: string;
  schema: SchemaMeta;
}

export interface SchemaMeta extends ActivationPolicy {
  kind: string;
  title?: string;
  description?: string;
  optional: boolean;
  /** 分支仍可展示当前值，但不能作为新的选择。 */
  disabled?: boolean;
  hasDefault: boolean;
  defaultValue?: unknown;
  fields?: Record<string, ObjectFieldMeta>;
  /** 指向 fields 中某个 boolean 字段；为 true（或默认 true 且无覆盖）时显示其余子项。 */
  toggleField?: string;
  /** 指向 fields 中某个枚举字段；根据该字段值选择 variants 中的专属子项。 */
  variantBy?: string;
  /** variantBy 切换时的字段保留策略：common 仅保留公共字段；matching 额外保留非机密且同类型同键的分支字段。 */
  variantPreserve?: "common" | "matching";
  variants?: Record<string, ObjectVariantMeta>;
  /** 可选声明式摘要拼接器，用于条目列表与入口副文本展示。 */
  preview?: SchemaPreview;
  unknownKeys?: string;
  item?: SchemaMeta;
  key?: SchemaMeta;
  recordValue?: SchemaMeta;
  /** 稀疏覆盖值，条目身份由外部目录决定。 */
  recordOverrides?: string;
  options?: SchemaMeta[];
  discriminator?: string;
  values?: unknown[];
  valueLabels?: Record<string, string>;
  /** string 格式控制原生输入类型；未知格式仍用普通文本。 */
  format?: string;
  step?: number;
  /** format=duration 的默认显示单位；数值存储为毫秒，缺省显示毫秒。 */
  timescale?: DurationTimescale;
  control?: "number" | "range";
  integer?: boolean;
  min?: number;
  max?: number;
  nonempty?: boolean;
  trim?: boolean;
  noCredentials?: boolean;
  value?: unknown;
  dynamicRef?: string;
  /** 页面式设置编辑的通用字段展示信息。 */
  secret?: boolean;
  multiline?: boolean;
  reference?: { path: string[]; label: string };
}

/** Structural subset shared by runtime schemas and editor metadata. */
export interface ActivationSchema extends ActivationPolicy {
  kind: string;
  toggleField?: string;
  variantBy?: string;
  fields?: Readonly<Record<string, { schema: ActivationSchema }>>;
  variants?: Readonly<
    Record<
      string,
      { fields?: Readonly<Record<string, { schema: ActivationSchema }>> }
    >
  >;
  item?: ActivationSchema;
  recordValue?: ActivationSchema;
  options?: readonly ActivationSchema[];
}

export type SettingsActivationStatus =
  | "active"
  | "pending"
  | "restart_required"
  | "apply_failed";

export interface SettingsIssue {
  path: string[];
  message: string;
}

export interface SettingsDifference {
  path: string[];
  before?: unknown;
  after?: unknown;
  secret?: boolean;
}

export type SettingsSecretAction = "set" | "keep" | "clear";

export type SettingsArrayEdit = { type: "array"; path: string[] } & (
  | { operation: "append"; value: unknown }
  | { operation: "remove"; index: number }
  | { operation: "move"; from: number; to: number }
);

export type SettingsEdit =
  | {
      type: "set";
      path: string[];
      value: unknown;
      entry?: "create" | "replace";
    }
  | SettingsArrayEdit
  | { type: "rename"; path: string[]; name: string }
  | { type: "reset"; path: string[] }
  | {
      type: "secret";
      path: string[];
      action: SettingsSecretAction;
      value?: string;
    };

export type SettingsRename = Extract<SettingsEdit, { type: "rename" }>;

export type SettingsStructure =
  | SettingsRename
  | Exclude<SettingsArrayEdit, { operation: "append" }>
  | { type: "array"; path: string[]; operation: "append"; index: number }
  | { type: "invalidate"; path: string[] }
  | { type: "removeTarget"; path: string[] };

export interface SettingsTransition {
  baseRevision: string;
  revision: string;
  renames: SettingsRename[];
  structures?: SettingsStructure[];
  /** 写命令的原始目标路径，不含配置值。 */
  writePaths?: string[][];
}

export interface SettingsCommand {
  commandId: string;
  expectedRevision: string;
}

export interface SettingsDraftState {
  baseRevision: string;
  conflicted: boolean;
}

export interface SettingsSnapshotBase<TSchema extends SchemaMeta = SchemaMeta> {
  revision: string;
  persistedRevision: string;
  /** 运行时最后采纳的文件版本，监听差异另由 restartRequiredPaths 表示。 */
  activeRevision: string;
  activationStatus: SettingsActivationStatus;
  activationError?: string;
  restartRequiredPaths?: string[][];
  draft: SettingsDraftState | null;
  overrides: Record<string, unknown>;
  effective: Record<string, unknown>;
  secrets: Record<string, boolean>;
  issues: SettingsIssue[];
  differences: SettingsDifference[];
  lastCommit?: { id: string; status: "applied" | "unknown" };
  schema: TSchema;
}
