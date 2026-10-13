import { RUN_CODE_NAME } from '@deepseek-ai/dsh-tools';

export function nativeToolName(logical: string): string {
  if (typeof logical !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$(?![\s\S])/.test(logical))
    throw new Error(`Invalid logical tool ID: ${String(logical)}`);
  const name = logical.replaceAll('.', '__');
  if (name === RUN_CODE_NAME) throw new Error(`Native tool name is reserved by DSH: ${name}`);
  return name;
}

export function assertToolBindings(logicalIds: readonly string[]): void {
  const names = new Map<string, string>();
  for (const logical of logicalIds) {
    const name = nativeToolName(logical);
    const prior = names.get(name);
    if (prior !== undefined)
      throw new Error(`Tool bindings ${prior} and ${logical} share native name ${name}.`);
    names.set(name, logical);
  }
}
