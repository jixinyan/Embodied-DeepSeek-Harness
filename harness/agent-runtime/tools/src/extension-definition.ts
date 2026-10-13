import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import { CORE_TOOLS } from './core-inputs.js';
import { assertToolBindings, nativeToolName } from './tool-names.js';

export function createExtensionToolDefinition<T>(
  logical: string,
  factory: (assignment: T) => ToolDefinition,
  assignment: T,
): ToolDefinition {
  assertToolBindings([...CORE_TOOLS, logical]);
  const definition = factory(structuredClone(assignment));
  if (definition.name !== nativeToolName(logical))
    throw new Error('Native tool name must match its logical binding.');
  return definition;
}
