type JsonSchema = any;

function hasNullType(schema: JsonSchema): boolean {
  if (!schema || typeof schema !== "object") return false;
  if (schema.const === null) return true;
  if (Array.isArray(schema.type) && schema.type.includes("null")) return true;
  if (schema.type === "null") return true;
  if (Array.isArray(schema.enum) && schema.enum.includes(null)) return true;
  const unions: JsonSchema[] = [
    ...(Array.isArray(schema.anyOf) ? schema.anyOf : []),
    ...(Array.isArray(schema.oneOf) ? schema.oneOf : []),
  ];
  return unions.some((u) => hasNullType(u));
}

function isArraySchema(schema: JsonSchema): boolean {
  if (!schema || typeof schema !== "object") return false;
  if (schema.type === "array") return true;
  if (Array.isArray(schema.type) && schema.type.includes("array")) return true;
  if (schema.items !== undefined) return true;
  const unions: JsonSchema[] = [
    ...(Array.isArray(schema.anyOf) ? schema.anyOf : []),
    ...(Array.isArray(schema.oneOf) ? schema.oneOf : []),
  ];
  return unions.some((u) => isArraySchema(u));
}

function makeNullable(schema: JsonSchema): JsonSchema {
  if (!schema || typeof schema !== "object") return schema;
  if (hasNullType(schema)) return schema;

  if (typeof schema.type === "string") {
    return { ...schema, type: [schema.type, "null"] };
  }
  if (Array.isArray(schema.type)) {
    return { ...schema, type: [...schema.type, "null"] };
  }

  return { anyOf: [schema, { type: "null" }] };
}

function deepClone<T>(value: T): T {
  // structuredClone is available in Node 18+.
  if (typeof (globalThis as any).structuredClone === "function") {
    return (globalThis as any).structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Converts a standard JSON Schema (draft-7) into the strict variant required by
 * Codex structured output:
 * - Every object with properties must have `required` listing all keys.
 * - Properties that were optional become nullable, except arrays which stay non-nullable
 *   (so the model must emit an empty array instead of null).
 */
export function toCodexStrictSchema(schema: JsonSchema): JsonSchema {
  const root = deepClone(schema);

  function visit(node: JsonSchema): JsonSchema {
    if (!node || typeof node !== "object") return node;

    if (node.$defs && typeof node.$defs === "object") {
      for (const key of Object.keys(node.$defs)) {
        node.$defs[key] = visit(node.$defs[key]);
      }
    }
    if (node.definitions && typeof node.definitions === "object") {
      for (const key of Object.keys(node.definitions)) {
        node.definitions[key] = visit(node.definitions[key]);
      }
    }

    if (Array.isArray(node.anyOf)) {
      node.anyOf = node.anyOf.map((s: JsonSchema) => visit(s));
    }
    if (Array.isArray(node.oneOf)) {
      node.oneOf = node.oneOf.map((s: JsonSchema) => visit(s));
    }
    if (Array.isArray(node.allOf)) {
      node.allOf = node.allOf.map((s: JsonSchema) => visit(s));
    }

    if (node.items) {
      node.items = visit(node.items);
    }

    if (
      node.type === "object" &&
      node.properties &&
      typeof node.properties === "object" &&
      !Array.isArray(node.properties)
    ) {
      const props: Record<string, JsonSchema> = node.properties;
      const originalRequired = new Set<string>(
        Array.isArray(node.required) ? node.required : [],
      );

      for (const key of Object.keys(props)) {
        props[key] = visit(props[key]);
      }

      const allKeys = Object.keys(props);
      node.required = allKeys;

      for (const key of allKeys) {
        if (!originalRequired.has(key)) {
          if (!isArraySchema(props[key])) {
            props[key] = makeNullable(props[key]);
          }
        }
      }
    }

    if (
      node.additionalProperties &&
      typeof node.additionalProperties === "object"
    ) {
      node.additionalProperties = visit(node.additionalProperties);
    }

    return node;
  }

  return visit(root);
}

