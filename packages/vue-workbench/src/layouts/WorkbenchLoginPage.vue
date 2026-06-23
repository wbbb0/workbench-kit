<script setup lang="ts">
import { computed } from "vue";
import WorkbenchCard from "../primitives/WorkbenchCard.vue";
import WorkbenchFormField from "../primitives/WorkbenchFormField.vue";
import WorkbenchTextInput from "../primitives/WorkbenchTextInput.vue";

const props = withDefaults(defineProps<{
  username?: string;
  password?: string;
  title?: string;
  brandLabel?: string;
  appLabel?: string;
  subtitle?: string;
  usernameLabel?: string;
  passwordLabel?: string;
  usernameAutocomplete?: string;
  passwordAutocomplete?: string;
  submitText?: string;
  pendingText?: string;
  passkeyText?: string;
  passkeyPendingText?: string;
  error?: string;
  pending?: boolean;
  passkeyPending?: boolean;
  showPasskey?: boolean;
  disabled?: boolean;
}>(), {
  username: "",
  password: "",
  title: "Sign in",
  brandLabel: "Workbench",
  appLabel: "",
  subtitle: "",
  usernameLabel: "Username",
  passwordLabel: "Password",
  usernameAutocomplete: "username webauthn",
  passwordAutocomplete: "current-password",
  submitText: "Sign in",
  pendingText: "Signing in...",
  passkeyText: "Sign in with Passkey",
  passkeyPendingText: "Waiting for passkey...",
  error: "",
  pending: false,
  passkeyPending: false,
  showPasskey: true,
  disabled: false
});

const emit = defineEmits<{
  "update:username": [value: string];
  "update:password": [value: string];
  submit: [payload: { username: string; password: string }];
  passkey: [];
}>();

const isSubmitDisabled = computed(() => props.disabled || props.pending);
const isPasskeyDisabled = computed(() => props.disabled || props.passkeyPending);

function submit() {
  if (isSubmitDisabled.value) {
    return;
  }
  emit("submit", {
    username: props.username,
    password: props.password
  });
}

function submitPasskey() {
  if (isPasskeyDisabled.value) {
    return;
  }
  emit("passkey");
}
</script>

<template>
  <div class="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center py-12">
    <WorkbenchCard surface="panel" padding="lg">
      <div class="mb-8">
        <div class="text-small uppercase text-text-subtle">
          {{ brandLabel }}
        </div>
        <h1 class="mt-2 text-lg font-semibold text-text-secondary">{{ title }}</h1>
        <p v-if="subtitle" class="mt-1 text-small text-text-muted">
          {{ subtitle }}
        </p>
        <p v-if="appLabel" class="mt-1 text-small text-text-muted">
          {{ appLabel }}
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <WorkbenchFormField :label="usernameLabel" required>
          <WorkbenchTextInput
            :autocomplete="usernameAutocomplete"
            :disabled="disabled || pending"
            :model-value="username"
            required
            @update:model-value="emit('update:username', $event)"
          />
        </WorkbenchFormField>

        <WorkbenchFormField :label="passwordLabel" required>
          <WorkbenchTextInput
            :autocomplete="passwordAutocomplete"
            :disabled="disabled || pending"
            :model-value="password"
            required
            type="password"
            @update:model-value="emit('update:password', $event)"
          />
        </WorkbenchFormField>

        <button
          type="submit"
          class="btn btn-primary w-full justify-center"
          :disabled="isSubmitDisabled"
        >
          {{ pending ? pendingText : submitText }}
        </button>
      </form>

      <template v-if="showPasskey">
        <div class="my-6 flex items-center gap-3 text-small uppercase text-text-subtle">
          <div class="h-px flex-1 bg-border-default" />
          <span>Or</span>
          <div class="h-px flex-1 bg-border-default" />
        </div>

        <button
          type="button"
          class="btn btn-secondary w-full justify-center"
          :disabled="isPasskeyDisabled"
          @click="submitPasskey"
        >
          {{ passkeyPending ? passkeyPendingText : passkeyText }}
        </button>
      </template>

      <p v-if="error" class="mt-4 text-small text-danger">
        {{ error }}
      </p>

      <div v-if="$slots.footer" class="mt-6">
        <slot name="footer" />
      </div>
    </WorkbenchCard>
  </div>
</template>
