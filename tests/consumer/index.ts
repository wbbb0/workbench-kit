import type { ActivationPolicy } from "@workbench-kit/schema";
import type { SchemaMeta } from "@workbench-kit/vue-resource-editor";
import { useScopedDialog, WorkbenchTabStrip } from "@workbench-kit/vue";
import type { ActivationPolicy as ExportedPolicy } from "@workbench-kit/vue";

export function policy(value: ActivationPolicy): ExportedPolicy {
  return value;
}
export type ConsumerSchema = SchemaMeta;
export const consumerComponents = { useScopedDialog, WorkbenchTabStrip };
