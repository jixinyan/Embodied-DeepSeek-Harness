import $RefParser from '@apidevtools/json-schema-ref-parser';
import type { ContractName, ContractValidator } from '@edh/contracts';
import { assertObjectJsonSchema } from '@edh/tools';

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Contract schema must contain an object node.');
  return value as Record<string, unknown>;
}

function supportedNode(value: unknown): Record<string, unknown> {
  const source = record(value);
  const node: Record<string, unknown> = {};
  for (const key of ['type', 'const', 'enum', 'description', 'title'])
    if (source[key] !== undefined) node[key] = structuredClone(source[key]);
  const constraints = [
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'multipleOf',
    'minLength',
    'maxLength',
    'pattern',
    'format',
    'minItems',
    'maxItems',
    'uniqueItems',
  ].filter((key) => source[key] !== undefined);
  if (constraints.length)
    node.description = [
      source.description,
      `Domain validation: ${constraints.map((key) => `${key}=${JSON.stringify(source[key])}`).join('; ')}.`,
    ]
      .filter(Boolean)
      .join(' ');
  if (node.type === undefined && (node.const !== undefined || node.enum !== undefined)) {
    const example = node.const ?? (Array.isArray(node.enum) ? node.enum[0] : undefined);
    node.type = example === null ? 'null' : typeof example;
  }
  if (source.properties !== undefined)
    node.properties = Object.fromEntries(
      Object.entries(record(source.properties)).map(([key, property]) => [
        key,
        supportedNode(property),
      ]),
    );
  if (source.required !== undefined) node.required = structuredClone(source.required);
  if (typeof source.additionalProperties === 'boolean')
    node.additionalProperties = source.additionalProperties;
  if (source.items !== undefined) node.items = supportedNode(source.items);
  if (source.oneOf !== undefined) {
    if (!Array.isArray(source.oneOf)) throw new Error('Contract oneOf must be an array.');
    node.oneOf = source.oneOf.map(supportedNode);
  }
  return node;
}

export async function modelToolContractSchema(
  validator: ContractValidator,
  name: ContractName,
): Promise<Record<string, unknown>> {
  const resolved = await $RefParser.dereference(validator.schemaDocument(name));
  const schema = supportedNode(resolved);
  assertObjectJsonSchema(schema);
  return schema;
}
