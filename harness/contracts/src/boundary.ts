import { Ajv, type ValidateFunction } from 'ajv';
import type { MessageTypeDefinition, ToolDefinition } from './generated.js';
import { ContractValidator, isWireTimestamp, type ContractName } from './validation.js';

type Schema = Record<string, unknown>;
export interface BoundaryExtensions {
  readonly schemas?: Readonly<Record<string, Schema>>;
  readonly messages?: readonly MessageTypeDefinition[];
}
const missing = Symbol('missing');
function pointer(value: unknown, path: string): unknown {
  for (const part of path
    .slice(1)
    .split('/')
    .map((key) => key.replaceAll('~1', '/').replaceAll('~0', '~'))) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) return missing;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ak = Object.keys(a),
    bk = Object.keys(b);
  return (
    ak.length === bk.length &&
    ak.every((key) => Object.hasOwn(b, key) && equal((a as Schema)[key], (b as Schema)[key]))
  );
}
function localSchema(schema: unknown, root: unknown = schema): void {
  if (schema === null || typeof schema !== 'object') return;
  if (Array.isArray(schema)) {
    for (const child of schema) localSchema(child, root);
    return;
  }
  const value = schema as Schema;
  if (Object.hasOwn(value, 'nullable')) throw new Error('Use Draft 7 null types, not nullable.');
  if (Object.hasOwn(value, 'format') && value.format !== 'date-time')
    throw new Error('Only the shared date-time format is supported.');
  if (Object.hasOwn(value, '$id'))
    throw new Error('Schema IDs are not supported; use a registered reference.');
  if (Object.hasOwn(value, '$ref')) {
    if (typeof value.$ref !== 'string' || (value.$ref !== '#' && !value.$ref.startsWith('#/')))
      throw new Error('Only local schema references are supported.');
    if (value.$ref !== '#' && pointer(root, value.$ref.slice(1)) === missing)
      throw new Error('Unresolved local schema reference.');
  }
  if (
    Object.hasOwn(value, '$schema') &&
    value.$schema !== 'http://json-schema.org/draft-07/schema#'
  )
    throw new Error('Only JSON Schema Draft 7 is supported.');
  for (const key of ['properties', 'patternProperties', 'definitions', '$defs', 'dependencies']) {
    const children = value[key];
    if (children !== null && typeof children === 'object' && !Array.isArray(children))
      for (const child of Object.values(children))
        if (!Array.isArray(child)) localSchema(child, root);
  }
  for (const key of [
    'items',
    'additionalItems',
    'additionalProperties',
    'contains',
    'propertyNames',
    'not',
    'if',
    'then',
    'else',
    'allOf',
    'anyOf',
    'oneOf',
  ])
    if (Object.hasOwn(value, key)) localSchema(value[key], root);
}

/** Frozen registration and pure cross-object checks; no routing, identity authentication or I/O. */
export class BoundaryValidator {
  readonly contracts: ContractValidator;
  private readonly source: Schema;
  private readonly ajv = new Ajv({ strict: false, strictNumbers: true, allErrors: true });
  private readonly schemas = new Map<string, ValidateFunction>();
  private readonly messages = new Map<string, MessageTypeDefinition>();
  private readonly constraints = new Map<string, ValidateFunction>();
  constructor(source: Schema, extensions: BoundaryExtensions = {}) {
    this.source = structuredClone(source);
    this.contracts = new ContractValidator(this.source);
    this.ajv.addFormat('date-time', { type: 'string', validate: isWireTimestamp });
    for (const [reference, schema] of Object.entries(extensions.schemas ?? {})) {
      if (!/^custom:[A-Za-z][A-Za-z0-9_.-]*\.v[1-9][0-9]*$(?![\s\S])/.test(reference))
        throw new Error(`Invalid custom schema reference: ${reference}`);
      const copy = structuredClone(schema);
      localSchema(copy);
      this.schemas.set(reference, this.ajv.compile(copy));
    }
    const builtins = Object.values(
      this.source['x-edh-message-types'] as Record<string, MessageTypeDefinition>,
    );
    for (const item of [...builtins, ...(extensions.messages ?? [])]) {
      const definition = structuredClone(this.contracts.parse('MessageTypeDefinition', item));
      if (this.messages.has(definition.type))
        throw new Error(`Duplicate message type: ${definition.type}`);
      this.resolve(definition.payload_schema);
      this.messages.set(definition.type, definition);
      if (definition.payload_constraints !== undefined) {
        localSchema(definition.payload_constraints);
        this.constraints.set(definition.type, this.ajv.compile(definition.payload_constraints));
      }
    }
  }
  private resolve(reference: string): ContractName | ValidateFunction {
    const name = /^builtin:([A-Za-z][A-Za-z0-9]*)\.v1$(?![\s\S])/.exec(reference)?.[1];
    if (name && Object.hasOwn(this.source.$defs as object, name)) return name as ContractName;
    const custom = this.schemas.get(reference);
    if (custom) return custom;
    throw new Error(`Unknown schema reference: ${reference}`);
  }
  private valid(reference: string, value: unknown): boolean {
    const schema = this.resolve(reference);
    return typeof schema === 'string'
      ? this.contracts.issues(schema, value).length === 0
      : Boolean(schema(value));
  }
  message(input: unknown): string[] {
    const message = this.contracts.parse('MessageEnvelope', input);
    const type = this.messages.get(message.type);
    if (!type) return ['unregistered_message_type'];
    const errors: string[] = [];
    if (message.type_version !== type.version) errors.push('message_version_mismatch');
    if (message.kind !== type.kind) errors.push('message_kind_mismatch');
    if (
      !this.valid(type.payload_schema, message.payload) ||
      this.constraints.get(type.type)?.(message.payload) === false
    )
      errors.push('invalid_message_payload');
    for (const binding of type.bindings) {
      const outer = pointer(message, binding.envelope_pointer),
        inner = pointer(message.payload, binding.payload_pointer);
      if (binding.optional && outer === missing && inner === missing) continue;
      if (outer === missing || inner === missing || !equal(outer, inner))
        errors.push('message_binding_mismatch');
    }
    return [...new Set(errors)];
  }
  definition(input: unknown): ToolDefinition {
    const definition = this.contracts.parse('ToolDefinition', input);
    this.resolve(definition.input_schema);
    this.resolve(definition.output_schema);
    return definition;
  }
  call(definitionInput: unknown, callInput: unknown): string[] {
    const definition = this.definition(definitionInput),
      call = this.contracts.parse('ToolCall', callInput);
    const errors: string[] = [];
    if (call.tool_id !== definition.tool_id || call.tool_version !== definition.version)
      errors.push('tool_binding_mismatch');
    const duration = Date.parse(call.deadline_at) - Date.parse(call.requested_at);
    if (duration <= 0 || duration > definition.timeout_s * 1000)
      errors.push('invalid_call_deadline');
    if (!this.valid(definition.input_schema, call.input)) errors.push('invalid_tool_input');
    return errors;
  }
  result(
    definitionInput: unknown,
    callInput: unknown,
    resultInput: unknown,
    operationId?: string,
  ): string[] {
    const definition = this.definition(definitionInput),
      call = this.contracts.parse('ToolCall', callInput),
      result = this.contracts.parse('ToolResult', resultInput);
    const errors = this.call(definition, call);
    if (
      [
        'call_id',
        'tool_id',
        'tool_version',
        'agent_id',
        'assignment_id',
        'team_run_id',
        'task_scope',
      ].some((key) => !equal((call as unknown as Schema)[key], (result as unknown as Schema)[key]))
    )
      errors.push('result_identity_mismatch');
    if (result.provider_id !== definition.executor.provider || result.effect !== definition.effect)
      errors.push('result_provider_mismatch');
    if (Date.parse(result.recorded_at) < Date.parse(call.requested_at))
      errors.push('result_before_call');
    if (
      definition.execution_mode === 'sync' &&
      (result.status === 'running' || result.operation_id !== undefined)
    )
      errors.push('sync_operation_mismatch');
    if (definition.execution_mode === 'async') {
      if (
        ['running', 'completed', 'cancelled'].includes(result.status) &&
        result.operation_id === undefined
      )
        errors.push('missing_operation_id');
      if (operationId !== undefined && result.operation_id !== operationId)
        errors.push('operation_identity_mismatch');
      if (
        !['running', 'unknown'].includes(result.status) &&
        result.operation_id !== undefined &&
        operationId === undefined
      )
        errors.push('missing_operation_context');
    }
    if (result.data !== undefined && !this.valid(definition.output_schema, result.data))
      errors.push('invalid_tool_output');
    return [...new Set(errors)];
  }
  /** Compare a redelivery with the stored original call; does not store or execute it. */
  replay(previousInput: unknown, nextInput: unknown): string[] {
    const previous = this.contracts.parse('ToolCall', previousInput);
    const next = this.contracts.parse('ToolCall', nextInput);
    if (previous.idempotency_key !== next.idempotency_key) return ['idempotency_identity_mismatch'];
    return equal(previous, next) ? [] : ['idempotency_conflict'];
  }
  operation(
    definitionInput: unknown,
    callInput: unknown,
    previousInput: unknown | null,
    nextInput: unknown,
    reconciled = false,
  ): string[] {
    const definition = this.definition(definitionInput),
      call = this.contracts.parse('ToolCall', callInput),
      next = this.contracts.parse('ToolOperation', nextInput);
    const previous =
      previousInput === null ? null : this.contracts.parse('ToolOperation', previousInput);
    const errors = this.call(definition, call);
    if (definition.execution_mode !== 'async') errors.push('sync_operation_mismatch');
    const identity = [
      'call_id',
      'tool_id',
      'tool_version',
      'agent_id',
      'assignment_id',
      'team_run_id',
      'task_scope',
      'idempotency_key',
    ];
    if (
      identity.some(
        (key) => !equal((call as unknown as Schema)[key], (next as unknown as Schema)[key]),
      )
    )
      errors.push('operation_call_mismatch');
    if (next.provider_id !== definition.executor.provider || next.effect !== definition.effect)
      errors.push('operation_provider_mismatch');
    if (Date.parse(next.recorded_at) < Date.parse(call.requested_at))
      errors.push('operation_before_call');
    if (previous === null) {
      if (next.state !== 'accepted' || next.state_version !== 0)
        errors.push('invalid_initial_operation');
    } else {
      if (!this.contracts.lifecycle.tool_operation?.[previous.state]?.includes(next.state))
        errors.push('invalid_operation_transition');
      if (next.state_version <= previous.state_version) errors.push('stale_operation_version');
      if (Date.parse(next.recorded_at) < Date.parse(previous.recorded_at))
        errors.push('operation_time_regression');
      if (
        [...identity, 'operation_id', 'provider_id', 'effect'].some(
          (key) => !equal((previous as unknown as Schema)[key], (next as unknown as Schema)[key]),
        ) ||
        !equal([...previous.resources].sort(), [...next.resources].sort())
      )
        errors.push('operation_identity_mismatch');
      if (previous.state === 'unknown' && next.state !== 'unknown' && !reconciled)
        errors.push('reconciliation_required');
    }
    if (next.result !== undefined) {
      errors.push(...this.result(definition, call, next.result, next.operation_id));
      if (
        next.state !== next.result.status ||
        next.result.recorded_at !== next.recorded_at ||
        !equal([...next.resources].sort(), [...next.result.resources].sort())
      )
        errors.push('operation_result_mismatch');
    }
    return [...new Set(errors)];
  }
}
