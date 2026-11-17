import type { Component } from "vue";
export type MessagePart =
  | { type: "text"; text: string }
  | { type: "code"; text: string; language?: string }
  | { type: "image"; url?: string; label: string };
export interface MessageItem {
  id: string;
  version: number;
  kind: string;
  author?: string;
  /** 可选侧边身份图标，隐藏重复的作者标题，保留可访问名称。 */
  identity?: { icon: Component; tone?: "accent" | "muted" };
  /** 紧凑活动行，只展示标签；完整 parts 保留供详情使用。 */
  activity?: { label: string };
  /** 带独立标题区的记录，正文仍由 parts 提供。 */
  heading?: string;
  metrics?: { label: string; value: string; title?: string }[];
  timestamp?: number;
  parts: MessagePart[];
  state?: { label: string; tone?: string };
  references?: { id: string; label: string }[];
  detail?: boolean;
  tone?: "danger" | "warning" | "success";
  actions?: { id: string; label: string; disabled?: boolean }[];
}
export interface ReadingAnchor {
  id: string;
  offset: number;
  bottom: boolean;
}
