import { Ajv, type ValidateFunction } from 'ajv';
import type { ContractTypes } from './generated.js';

export type ContractName = keyof ContractTypes;
export interface ContractIssue {
  readonly path: string;
  readonly keyword: string;
  readonly message: string;
}
export class ContractValidationError extends Error {
  constructor(
    readonly contract: string,
    readonly issues: readonly ContractIssue[],
  ) {
    super(
      `${contract}: ${issues.map((issue) => `${issue.path || '/'} ${issue.message}`).join('; ')}`,
    );
    this.name = 'ContractValidationError';
  }
}

/** UTC, whole-second or millisecond timestamps with calendar validation. */
export function isWireTimestamp(value: string): boolean {
  if (!/^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{3})?Z$/.test(value))
    return false;
  const date = new Date(value);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString() === (value.includes('.') ? value : value.replace('Z', '.000Z'))
  );
}

function isJson(value: unknown, parents = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || parents.has(value)) return false;
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    return false;
  if (Object.getOwnPropertySymbols(value).length !== 0) return false;
  parents.add(value);
  const valid = Array.isArray(value)
    ? Object.keys(value).length === value.length && value.every((item) => isJson(item, parents))
    : Object.values(value).every((item) => isJson(item, parents));
  parents.delete(value);
  return valid;
}

/** Validate wire shape without coercing values, dropping fields or inserting defaults. */
export class ContractValidator {
  private readonly ajv = new Ajv({ strict: false, strictNumbers: true, allErrors: true });
  private readonly compiled = new Map<string, ValidateFunction>();
  readonly lifecycle: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
  private readonly schema: Record<string, unknown>;
  constructor(schema: Record<string, unknown>) {
    this.schema = structuredClone(schema);
    this.ajv.addFormat('date-time', { type: 'string', validate: isWireTimestamp });
    if (!this.ajv.validateSchema(this.schema)) throw new Error(this.ajv.errorsText());
    this.lifecycle = this.schema['x-edh-lifecycle'] as typeof this.lifecycle;
  }
  issues(name: ContractName, value: unknown): ContractIssue[] {
    const definitions = this.schema.$defs as Record<string, unknown>;
    if (!Object.hasOwn(definitions, name)) throw new Error(`Unknown contract: ${name}`);
    if (!isJson(value))
      return [{ path: '', keyword: 'json', message: 'Expected finite, acyclic JSON data.' }];
    let validate = this.compiled.get(name);
    if (validate === undefined) {
      validate = this.ajv.compile({ $defs: definitions, $ref: `#/$defs/${name}` });
      this.compiled.set(name, validate);
    }
    if (!validate(value))
      return (validate.errors ?? []).map((error) => ({
        path: error.instancePath,
        keyword: error.keyword,
        message: error.message ?? 'Invalid value.',
      }));
    return fieldRelations(name, value as ContractTypes[ContractName]);
  }
  parse<K extends ContractName>(name: K, value: unknown): ContractTypes[K] {
    const issues = this.issues(name, value);
    if (issues.length !== 0) throw new ContractValidationError(name, issues);
    return value as ContractTypes[K];
  }
}

function fieldRelations(name: ContractName, value: ContractTypes[ContractName]): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const add = (path: string, message: string) =>
    issues.push({ path, keyword: 'relation', message });
  const unique = (items: readonly string[], path: string) => {
    if (new Set(items).size !== items.length) add(path, 'Identifiers must be unique.');
  };
  if (name === 'SuccessContract') {
    const contract = value as ContractTypes['SuccessContract'];
    unique(
      ('all' in contract ? contract.all : contract.any).map((check) => check.check_id),
      '/checks',
    );
  }
  if (name === 'ActionSpec') {
    const spec = value as ContractTypes['ActionSpec'];
    unique(
      spec.channels.map((channel) => channel.name),
      '/channels',
    );
    spec.channels.forEach((channel, i) => {
      if (channel.minimum > channel.maximum) add(`/channels/${i}`, 'Minimum exceeds maximum.');
    });
  }
  if (name === 'ActionChannel') {
    const channel = value as ContractTypes['ActionChannel'];
    if (channel.minimum > channel.maximum) add('', 'Minimum exceeds maximum.');
  }
  if (name === 'SegmentationResult') {
    const result = value as ContractTypes['SegmentationResult'];
    unique(
      result.instances.map((instance) => instance.detection_id),
      '/instances',
    );
    result.instances.forEach((instance, i) => {
      const [x1, y1, x2, y2] = instance.bbox_xyxy;
      if (x1 > x2 || y1 > y2)
        add(`/instances/${i}/bbox_xyxy`, 'Bounding-box coordinates are reversed.');
    });
  }
  if (name === 'VerificationResult')
    unique(
      (value as ContractTypes['VerificationResult']).checks.map((check) => check.check_id),
      '/checks',
    );
  // Nested success contracts need the same identity check as standalone values.
  if (name === 'SubgoalRequest' || name === 'InvocationBrief') {
    const nested = value as ContractTypes['SubgoalRequest'] | ContractTypes['InvocationBrief'];
    issues.push(...fieldRelations('SuccessContract', nested.success_contract));
  }
  if (name === 'PlanDocument') {
    const plan = value as ContractTypes['PlanDocument'];
    unique(
      plan.items.map((item) => item.goal_id),
      '/items',
    );
    for (const item of plan.items)
      issues.push(...fieldRelations('SuccessContract', item.success_contract));
  }
  return issues;
}
