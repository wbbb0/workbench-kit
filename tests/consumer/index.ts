import type { ActivationPolicy } from "@workbench-kit/schema";
import type { SchemaMeta } from "@workbench-kit/vue-resource-editor";
import {
  useScopedDialog,
  WorkbenchRoot,
  WorkbenchShell,
  WorkbenchTabStrip,
} from "@workbench-kit/vue";
import type { ActivationPolicy as ExportedPolicy } from "@workbench-kit/vue";

type AssertAssignable<To, _From extends To> = true;
type WorkbenchRootProps = InstanceType<typeof WorkbenchRoot>["$props"];
type WorkbenchShellProps = InstanceType<typeof WorkbenchShell>["$props"];

export type HideEmptyTopbarConsumerChecks = [
  AssertAssignable<WorkbenchRootProps["hideEmptyTopbar"], undefined>,
  AssertAssignable<WorkbenchRootProps["hideEmptyTopbar"], boolean>,
  AssertAssignable<boolean | undefined, WorkbenchRootProps["hideEmptyTopbar"]>,
  AssertAssignable<WorkbenchShellProps["hideEmptyTopbar"], undefined>,
  AssertAssignable<WorkbenchShellProps["hideEmptyTopbar"], boolean>,
  AssertAssignable<boolean | undefined, WorkbenchShellProps["hideEmptyTopbar"]>,
];

export function policy(value: ActivationPolicy): ExportedPolicy {
  return value;
}
export type ConsumerSchema = SchemaMeta;
export const consumerComponents = {
  useScopedDialog,
  WorkbenchRoot,
  WorkbenchShell,
  WorkbenchTabStrip,
};
