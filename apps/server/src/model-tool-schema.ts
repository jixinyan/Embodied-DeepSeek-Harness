import $RefParser from '@apidevtools/json-schema-ref-parser';
import type { ContractName, ContractValidator } from '@edh/contracts';
import {
  assertObjectJsonSchema,
  CORE_TOOL_PARAMETERS,
  CORE_TOOL_OPTIONAL_PARAMETERS,
} from '@edh/tools';

export function coreModelToolParameters(
  logical: string,
  options: {
    planSchema?: Record<string, unknown>;
    roleOutputSchema?: object;
    rotationAxes?: readonly string[];
    activeViewDirections?: readonly string[];
    simulatorInspectionCheckIds?: readonly string[];
  } = {},
): Record<string, unknown> {
  const properties = CORE_TOOL_PARAMETERS[logical];
  if (!properties) throw new Error(`Tool is not implemented: ${logical}`);
  let selected: Record<string, unknown> = properties;
  if (logical === 'agent.report')
    selected = {
      ...properties,
      result: {
        description:
          'Structured role output; null when requesting missing context. Follow the selected role result schema.',
        oneOf: [
          options.roleOutputSchema ?? { type: 'object', additionalProperties: true },
          { type: 'null' },
        ],
      },
    };
  if (logical === 'observation.rotate') {
    if (!options.rotationAxes) throw new Error('Device rotation axes are unavailable.');
    selected = Object.fromEntries(
      Object.entries(properties).map(([name, schema]) => [
        name,
        options.rotationAxes!.includes(name === 'yawDeg' ? 'yaw' : 'pitch')
          ? schema
          : {
              type: 'number',
              const: 0,
              description: 'This device does not support this rotation axis; supply 0.',
            },
      ]),
    );
  }
  if (logical === 'observation.turn_view') {
    if (!options.activeViewDirections)
      throw new Error('Device active view directions are unavailable.');
    selected = {
      ...properties,
      direction: {
        type: 'string',
        description: 'One active observation direction supported by this device.',
        enum: [...options.activeViewDirections],
      },
    };
  }
  if (logical === 'planning.update') {
    if (!options.planSchema) throw new Error('PlanDocument tool schema has not been prepared.');
    selected = {
      ...properties,
      plan: {
        ...options.planSchema,
        description:
          'Use planning.read.planWrite.plan, a nested JSON object with schema_version, task_id, version, owner_agent_id, owner_assignment_id and items. Edit its items for your decisions. Preserve the supplied identities and criteria, and pair it with planWrite.expectedVersion. The value begins with an object brace; keep objects, arrays and numeric versions as their JSON types.',
      },
    };
  }
  if (logical === 'perception.inspect_simulator') {
    if (!options.simulatorInspectionCheckIds?.length)
      throw new Error('Simulator inspection catalog checks are unavailable.');
    selected = {
      checkIds: {
        type: 'array',
        items: { type: 'string', enum: [...options.simulatorInspectionCheckIds] },
        description:
          'Distinct advertised native conditions to inspect for the current execution decision.',
      },
    };
  }
  return {
    type: 'object',
    properties: selected,
    required: Object.keys(properties).filter(
      (key) => !CORE_TOOL_OPTIONAL_PARAMETERS[logical]?.includes(key),
    ),
    additionalProperties: false,
  };
}

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
