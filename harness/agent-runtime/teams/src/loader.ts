import { readFile, realpath } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { parseDocument } from 'yaml';
import { ContractValidator, type RoleDefinition } from '@edh/contracts';
import type { TeamRunSnapshot } from './index.js';

export interface ResolvedRole {
  readonly definition: Readonly<RoleDefinition>;
  readonly instructions: string;
  readonly model: string;
}
export interface LoadedTeam extends TeamRunSnapshot {
  readonly members: Readonly<Record<string, ResolvedRole>>;
}
export interface TeamLoadOptions {
  readonly validator: ContractValidator;
  readonly builtinDirectory: string;
  readonly roleRoot: string;
  readonly defaultModel: string;
  readonly models: readonly string[];
  readonly tools: readonly string[];
  readonly providers: readonly string[];
}
function yaml(text: string, label: string): unknown {
  const doc = parseDocument(text, { uniqueKeys: true });
  if (doc.errors.length)
    throw new Error(`${label}: ${doc.errors.map((e) => e.message).join('; ')}`);
  return doc.toJS({ maxAliasCount: 0 });
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
async function within(file: string, root: string): Promise<string> {
  const actual = await realpath(file);
  const rel = relative(await realpath(root), actual);
  if (rel === '..' || rel.startsWith('../') || isAbsolute(rel))
    throw new Error(`Role escapes configured root: ${file}`);
  return actual;
}
/** Configuration preflight only. DSH remains the session and tool authority. */
export class FileTeamLoader {
  constructor(private readonly options: TeamLoadOptions) {}
  async inspect(file: string): Promise<LoadedTeam> {
    const o = this.options;
    const source = await readFile(file, 'utf8');
    const definition = o.validator.parse('TeamDefinition', yaml(source, file));
    const builtins = JSON.parse(
      await readFile(resolve(o.builtinDirectory, 'builtins.json'), 'utf8'),
    ) as Record<string, string>;
    const members: Record<string, ResolvedRole> = Object.create(null);
    const roles: Record<string, RoleDefinition> = Object.create(null);
    const digest = createHash('sha256').update(source);
    for (const [alias, ref] of Object.entries(definition.members)) {
      const builtin = ref.startsWith('builtin:');
      const target = builtin ? builtins[ref.slice(8)] : ref;
      if (!target) throw new Error(`Unknown builtin role: ${ref}`);
      const location = await within(
        resolve(builtin ? o.builtinDirectory : dirname(file), target),
        builtin ? o.builtinDirectory : o.roleRoot,
      );
      const markdown = await readFile(location, 'utf8');
      const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/.exec(markdown);
      if (!match) throw new Error(`Role requires YAML frontmatter and instructions: ${location}`);
      const role = o.validator.parse('RoleDefinition', yaml(match[1]!, location));
      const model = role.model ?? o.defaultModel;
      if (!o.models.includes(model))
        throw new Error(`Unknown model binding for ${alias}: ${model}`);
      for (const tool of role.tools)
        if (!o.tools.includes(tool)) throw new Error(`Unavailable tool for ${alias}: ${tool}`);
      if (new Set(role.tools).size !== role.tools.length)
        throw new Error(`Duplicate tool binding for ${alias}`);
      if (role.output_schema)
        throw new Error(`Output schema binding is not configured: ${role.output_schema}`);
      roles[alias] = role;
      members[alias] = { definition: role, instructions: match[2]!.trim(), model };
      digest.update(alias).update(markdown).update(model);
    }
    for (const [tool, provider] of Object.entries(definition.tool_bindings)) {
      if (!o.tools.includes(tool)) throw new Error(`Unavailable bound tool: ${tool}`);
      if (!o.providers.includes(provider)) throw new Error(`Unavailable provider: ${provider}`);
    }
    return freeze({
      teamRunId: randomUUID(),
      definition,
      roles,
      members,
      sourceDigest: digest.digest('hex'),
    });
  }
}
