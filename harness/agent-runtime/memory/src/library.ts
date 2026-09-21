import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LocalStore } from '@edh/storage';
import type { ContractValidator, SkillMetadata } from '@edh/contracts';
import type { SkillBundle } from './index.js';

export const SKILL_SECTIONS = [
  'When to use',
  'Failure signals',
  'Possible causes',
  'Avoid',
  'Planning guidance',
  'Verification guidance',
  'Limits',
  'Source',
] as const;
export class SkillLibrary {
  constructor(
    private readonly store: LocalStore,
    private readonly validator: ContractValidator,
  ) {}
  search(query: string, includeFixtures = false): SkillMetadata[] {
    const words = query.toLowerCase().split(/\W+/).filter(Boolean);
    const matches: SkillMetadata[] = [];
    if (!words.length) return matches;
    for (const record of this.store.scan<SkillBundle>('skill:')) {
      const metadata = record.value.metadata;
      if (
        (includeFixtures || metadata.origin !== 'test_fixture') &&
        words.some((word) => metadata.task_semantics.join(' ').toLowerCase().includes(word))
      ) {
        matches.push(metadata);
        if (matches.length === 20) break;
      }
    }
    return matches;
  }
  load(id: string): SkillBundle {
    const r = this.store.get<SkillBundle>(`skill:${id}`);
    if (!r) throw new Error('Skill not found.');
    return r.value;
  }
  /** Caller provides trusted successful-recovery provenance; the model supplies only prose. */
  save(metadata: SkillMetadata, markdown: string): SkillBundle {
    this.validator.parse('SkillMetadata', metadata);
    if (!markdown.trim() || Buffer.byteLength(markdown) > 64 * 1024)
      throw new Error('Invalid skill content.');
    for (const section of SKILL_SECTIONS) {
      if (!markdown.includes(`## ${section}\n`))
        throw new Error(`Skill requires section: ${section}`);
    }
    if (!metadata.evidence_refs.length || !metadata.verdict_ref)
      throw new Error('Skill requires evidence and accepted verdict.');
    const bundle = { metadata, markdown };
    const key = `skill:${metadata.skill_id}`;
    const old = this.store.get<SkillBundle>(key);
    if (old) {
      if (JSON.stringify(old.value) !== JSON.stringify(bundle))
        throw new Error('Skill version is immutable.');
      return old.value;
    }
    this.store.put(key, bundle, 0);
    this.export(bundle);
    return bundle;
  }
  export(bundle: SkillBundle): void {
    // The durable record is authoritative. Export can be regenerated after interruption.
    if (!/^[A-Za-z0-9-]+$/.test(bundle.metadata.skill_id))
      throw new Error('Invalid skill export identifier.');
    const directory = resolve(this.store.directory, 'skills', bundle.metadata.skill_id);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const target = resolve(directory, 'SKILL.md');
    const temporary = target + '.tmp';
    writeFileSync(
      temporary,
      `---\n${JSON.stringify(bundle.metadata, null, 2)}\n---\n\n${bundle.markdown}\n`,
      { mode: 0o600 },
    );
    renameSync(temporary, target);
  }
  exportAll(): void {
    for (const r of this.store.scan<SkillBundle>('skill:')) this.export(r.value);
  }
}
