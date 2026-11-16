export type MessagePart =
  | { type: "text"; text: string }
  | { type: "code"; text: string; language?: string }
  | { type: "image"; url?: string; label: string };
export interface MessageItem {
  id: string;
  version: number;
  kind: string;
  author?: string;
  timestamp?: number;
  parts: MessagePart[];
  state?: { label: string; tone?: string };
  references?: { id: string; label: string }[];
  detail?: boolean;
  tone?: 'danger' | 'warning' | 'success';
  actions?: { id: string; label: string; disabled?: boolean }[];
}
export interface ReadingAnchor {
  id: string;
  offset: number;
  bottom: boolean;
}
