// Runtime memory exports and interfaces for provider extensions.
import type { EvidenceRef, SkillMetadata } from '@edh/contracts';
export interface SkillBundle {
  readonly metadata: SkillMetadata;
  readonly markdown: string;
}
export interface SkillSelection {
  readonly fullDocument: false;
  readonly requestedSections: readonly string[];
  readonly includedSections: readonly string[];
  readonly omittedSections: readonly string[];
  readonly sourceBytes: number;
  readonly returnedBytes: number;
}
export interface SkillRead extends SkillBundle {
  readonly selection?: SkillSelection;
}
export interface SkillQuery {
  readonly assignmentId: string;
  readonly taskSemantics: readonly string[];
  readonly capabilities: readonly string[];
}
export interface SkillStore {
  search(query: SkillQuery): Promise<readonly SkillMetadata[]>;
  load(
    assignmentId: string,
    skillId: string,
    version: string,
    sections?: readonly string[],
  ): Promise<SkillRead>;
  save(assignmentId: string, bundle: SkillBundle): Promise<void>;
}
export interface EvidenceReader {
  resolve(assignmentId: string, evidenceId: string): Promise<EvidenceRef>;
}

export { SkillLibrary } from './library.js';
export { AssignmentEvidenceGrants } from './evidence-grants.js';

export {
  installContextManagement,
  contextManagementOptions,
  type ContextManagementOptions,
} from './context.js';

export type { VisualHistoryOptions } from './visual-history.js';
