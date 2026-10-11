import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LocalStore } from '@edh/storage';
import type { ContractValidator, SkillMetadata } from '@edh/contracts';
import { skillSections, selectSkillSections, type SkillSelection } from './skill-sections.js';

export interface SkillBundle {
  readonly metadata: SkillMetadata;
  readonly markdown: string;
}
export interface SkillRead extends SkillBundle {
  readonly selection?: SkillSelection;
}

export { SKILL_SECTIONS } from './skill-sections.js';
export class SkillLibrary {
  constructor(
    private readonly store: LocalStore,
    private readonly validator: ContractValidator,
  ) {}
  private admitMetadata(
    key: string,
    record: { version: number; value: SkillBundle },
  ): SkillMetadata {
    if (record.version !== 1) throw new Error('Skill record was rewritten.');
    const metadata = this.validator.parse('SkillMetadata', record.value.metadata);
    if (key !== `skill:${metadata.skill_id}`)
      throw new Error('Skill identity does not match its stored key.');
    return metadata;
  }
  search(query: string, includeFixtures = false): SkillMetadata[] {
    const words = query.toLowerCase().split(/\W+/).filter(Boolean);
    const matches: SkillMetadata[] = [];
    if (!words.length) return matches;
    for (const record of this.store.scan<SkillBundle>('skill:')) {
      const metadata = this.admitMetadata(record.key, record);
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
  load(id: string, sections?: readonly string[]): SkillRead {
    const r = this.store.get<SkillBundle>(`skill:${id}`);
    if (!r) throw new Error('Skill not found.');
    const metadata = this.admitMetadata(`skill:${id}`, r);
    if (sections !== undefined)
      return { metadata, ...selectSkillSections(r.value.markdown, sections) };
    skillSections(r.value.markdown);
    return { metadata, markdown: r.value.markdown };
  }
  // 调用方提供已经验证的 recovery 来源；模型只提供正文。
  save(metadata: SkillMetadata, markdown: string): SkillBundle {
    this.validator.parse('SkillMetadata', metadata);
    skillSections(markdown);
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
    // 持久记录是权威来源；中断后可以重新导出。
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
