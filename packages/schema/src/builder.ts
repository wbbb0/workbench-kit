import type {
  DurationTimescale,
  ObjectFieldMeta,
  ObjectVariantMeta,
  SchemaMeta,
  SchemaPreview,
} from "./types.js";

export type TypedSchema<
  Fields extends Record<string, any> = Record<string, never>,
  Secret extends boolean = false,
  Value = unknown,
> = SchemaMeta & {
  readonly __fields?: Fields;
  readonly __secret?: Secret;
  readonly __value?: Value;
};

export type AnyTypedSchema = TypedSchema<any, boolean, any>;

type FieldsOf<S> =
  S extends TypedSchema<infer F, any, any> ? F : Record<string, never>;
type IsSecret<S> = S extends TypedSchema<any, true, any> ? true : false;
type ValueOf<S> = S extends TypedSchema<any, any, infer V> ? V : unknown;

export type PreviewPaths<F extends Record<string, AnyTypedSchema>> = {
  [K in keyof F & string]: IsSecret<F[K]> extends true
    ? never
    : keyof FieldsOf<F[K]> extends never
      ? K
      : K | `${K}.${PreviewPaths<FieldsOf<F[K]>>}`;
}[keyof F & string];

type BooleanKeys<F extends Record<string, AnyTypedSchema>> = {
  [K in keyof F & string]: [ValueOf<F[K]>] extends [boolean] ? K : never;
}[keyof F & string];

type StringKeys<F extends Record<string, AnyTypedSchema>> = {
  [K in keyof F & string]: ValueOf<F[K]> extends string ? K : never;
}[keyof F & string];

export interface PreviewBuilder<F extends Record<string, AnyTypedSchema>> {
  ref<P extends PreviewPaths<F>>(
    path: P,
    options?: {
      format?: "value" | "label" | "count";
      fallback?: string;
    },
  ): SchemaPreview;
  join(
    separator: string,
    ...parts: (SchemaPreview | undefined | null | false)[]
  ): SchemaPreview;
  tpl(
    strings: TemplateStringsArray,
    ...values: (SchemaPreview | string | number | undefined)[]
  ): SchemaPreview;
  tplAll(
    strings: TemplateStringsArray,
    ...values: (SchemaPreview | string | number | undefined)[]
  ): SchemaPreview;
}

function createPreviewBuilder<
  F extends Record<string, AnyTypedSchema>,
>(): PreviewBuilder<F> {
  const buildTpl = (
    all: boolean,
    strings: TemplateStringsArray,
    values: (SchemaPreview | string | number | undefined)[],
  ): SchemaPreview => {
    const parts: SchemaPreview[] = [];
    for (let i = 0; i < strings.length; i++) {
      const literal = strings[i];
      if (literal) parts.push(literal);
      if (i < values.length) {
        const value = values[i];
        if (value !== undefined) {
          parts.push(typeof value === "number" ? String(value) : value);
        }
      }
    }
    return all ? { tpl: parts, all: true } : { tpl: parts };
  };
  return {
    ref(path, options) {
      return {
        ref: path.split("."),
        ...(options?.format !== undefined ? { format: options.format } : {}),
        ...(options?.fallback !== undefined
          ? { fallback: options.fallback }
          : {}),
      };
    },
    join(separator, ...parts) {
      return {
        join: separator,
        parts: parts.filter(
          (part): part is SchemaPreview =>
            part !== undefined && part !== null && part !== false,
        ),
      };
    },
    tpl(strings, ...values) {
      return buildTpl(false, strings, values);
    },
    tplAll(strings, ...values) {
      return buildTpl(true, strings, values);
    },
  };
}

function resolvePreviewInput<F extends Record<string, AnyTypedSchema>>(
  preview: SchemaPreview | ((builder: PreviewBuilder<F>) => SchemaPreview),
): SchemaPreview {
  return typeof preview === "function"
    ? preview(createPreviewBuilder<F>())
    : preview;
}

export function defineField<S extends boolean = false, V = unknown>(
  kind: string,
  title: string,
  extra: Partial<SchemaMeta> = {},
): TypedSchema<Record<string, never>, S, V> {
  return {
    kind,
    title,
    optional: false,
    hasDefault: false,
    ...extra,
  } as TypedSchema<Record<string, never>, S, V>;
}

export function defineString<S extends boolean = false>(
  title: string,
  defaultValue?: string,
  extra: Partial<SchemaMeta> & { secret?: S } = {},
): TypedSchema<Record<string, never>, S, string> {
  return defineField<S, string>("string", title, {
    ...(defaultValue === undefined ? {} : { hasDefault: true, defaultValue }),
    ...extra,
  });
}

export function defineBoolean(
  title: string,
  defaultValue?: boolean,
  extra: Partial<SchemaMeta> = {},
): TypedSchema<Record<string, never>, false, boolean> {
  return defineField<false, boolean>("boolean", title, {
    ...(defaultValue === undefined ? {} : { hasDefault: true, defaultValue }),
    ...extra,
  });
}

export function defineNumber(
  title: string,
  defaultValue?: number,
  extra: Partial<SchemaMeta> & { timescale?: DurationTimescale } = {},
): TypedSchema<Record<string, never>, false, number> {
  return defineField<false, number>("number", title, {
    integer: true,
    min: 1,
    step: 1,
    ...(defaultValue === undefined ? {} : { hasDefault: true, defaultValue }),
    ...extra,
  });
}

export function defineLiteral<const V extends string | number | boolean | null>(
  value: V,
  withDefault = false,
  extra: Partial<SchemaMeta> = {},
): TypedSchema<Record<string, never>, false, V> {
  return defineField<false, V>("literal", String(value), {
    value,
    ...(withDefault ? { hasDefault: true, defaultValue: value } : {}),
    ...extra,
  });
}

export function defineEnum<const Values extends readonly string[]>(
  title: string,
  values: Values,
  extra: Partial<SchemaMeta> = {},
): TypedSchema<Record<string, never>, false, Values[number]> {
  return defineField<false, Values[number]>("enum", title, {
    values: [...values],
    ...extra,
  });
}

export function defineEnumSet<const Values extends readonly string[]>(
  title: string,
  values: Values,
  extra: Partial<SchemaMeta> = {},
): TypedSchema<Record<string, never>, false, Values[number][]> {
  return defineField<false, Values[number][]>("enum-set", title, {
    optional: true,
    values: [...values],
    ...extra,
  });
}

export function defineArray<Item extends AnyTypedSchema>(
  title: string,
  item: Item,
  extra: Partial<SchemaMeta> = {},
): TypedSchema<Record<string, never>, false, ValueOf<Item>[]> {
  return defineField("array", title, {
    item,
    hasDefault: true,
    defaultValue: [],
    ...extra,
  });
}

export function defineRecord<V extends AnyTypedSchema>(
  title: string,
  recordValue: V,
  extra: Partial<SchemaMeta> = {},
): TypedSchema<Record<string, never>, false, Record<string, ValueOf<V>>> {
  return defineField("record", title, {
    recordValue,
    hasDefault: true,
    defaultValue: {},
    ...extra,
  });
}

export function defineOptional<S extends AnyTypedSchema>(
  schema: S,
): TypedSchema<FieldsOf<S>, IsSecret<S>, ValueOf<S> | undefined> {
  return {
    ...schema,
    optional: true,
    hasDefault: false,
  } as unknown as TypedSchema<FieldsOf<S>, IsSecret<S>, ValueOf<S> | undefined>;
}

export function defineObject<F extends Record<string, AnyTypedSchema>>(
  title: string,
  fields: F,
  options: {
    defaults?: boolean;
    optional?: boolean;
    description?: string;
    activation?: "live" | "restart";
    unknownKeys?: string;
    toggleField?: BooleanKeys<F>;
    preview?: SchemaPreview | ((p: PreviewBuilder<F>) => SchemaPreview);
  } = {},
): TypedSchema<F, false, Record<string, unknown>> {
  const defaults = options.defaults ?? true;
  const { defaults: _defaults, preview, ...rest } = options;
  return {
    kind: "object",
    title,
    optional: options.optional ?? false,
    hasDefault: defaults,
    ...(defaults ? { defaultValue: {} } : {}),
    fields: Object.fromEntries(
      Object.entries(fields).map(([key, schema]) => [key, { schema }]),
    ) as Record<string, ObjectFieldMeta>,
    ...(preview !== undefined
      ? { preview: resolvePreviewInput<F>(preview) }
      : {}),
    ...rest,
  } as TypedSchema<F, false, Record<string, unknown>>;
}

export interface VariantDefinition<
  Common extends Record<string, AnyTypedSchema>,
  Extra extends Record<string, AnyTypedSchema> = Record<string, never>,
> {
  title?: string;
  description?: string;
  disabled?: boolean;
  fields?: Extra;
  preview?:
    | SchemaPreview
    | ((p: PreviewBuilder<Common & Extra>) => SchemaPreview);
}

export function defineVariantObject<
  Common extends Record<string, AnyTypedSchema>,
  const K extends StringKeys<Common>,
  const Variants extends Record<string, VariantDefinition<Common, any>>,
>(
  title: string,
  fields: Common,
  options: {
    variantBy: K;
    variantPreserve?: "common" | "matching";
    variants: Variants;
    defaults?: boolean;
    optional?: boolean;
    description?: string;
    activation?: "live" | "restart";
    toggleField?: BooleanKeys<Common>;
    preview?: SchemaPreview | ((p: PreviewBuilder<Common>) => SchemaPreview);
  },
): TypedSchema<Common, false, Record<string, unknown>> {
  const defaults = options.defaults ?? false;
  const compiledVariants: Record<string, ObjectVariantMeta> = {};
  for (const [key, variant] of Object.entries(options.variants)) {
    compiledVariants[key] = {
      ...(variant.title !== undefined ? { title: variant.title } : {}),
      ...(variant.description !== undefined
        ? { description: variant.description }
        : {}),
      ...(variant.disabled !== undefined ? { disabled: variant.disabled } : {}),
      ...(variant.fields !== undefined
        ? {
            fields: Object.fromEntries(
              Object.entries(variant.fields as Record<string, SchemaMeta>).map(
                ([fKey, schema]) => [fKey, { schema }],
              ),
            ),
          }
        : {}),
      ...(variant.preview !== undefined
        ? {
            preview: resolvePreviewInput<Common & Record<string, AnyTypedSchema>>(
              variant.preview,
            ),
          }
        : {}),
    };
  }
  const {
    defaults: _defaults,
    preview,
    variants: _variants,
    ...rest
  } = options;
  return {
    kind: "object",
    title,
    optional: options.optional ?? false,
    hasDefault: defaults,
    ...(defaults ? { defaultValue: {} } : {}),
    fields: Object.fromEntries(
      Object.entries(fields).map(([key, schema]) => [key, { schema }]),
    ) as Record<string, ObjectFieldMeta>,
    variants: compiledVariants,
    ...(preview !== undefined
      ? { preview: resolvePreviewInput<Common>(preview) }
      : {}),
    ...rest,
  } as TypedSchema<Common, false, Record<string, unknown>>;
}

export function defineUnion(
  title: string,
  options: AnyTypedSchema[],
  extra: Partial<SchemaMeta> = {},
): AnyTypedSchema {
  return defineField("union", title, {
    options,
    ...extra,
  });
}
