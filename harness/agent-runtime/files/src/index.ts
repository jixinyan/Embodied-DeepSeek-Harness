// Architecture contract only. No runtime implementation.
export interface WorkspaceFile {
  readonly path: string;
  readonly content: string;
  readonly version: string;
}
export interface AgentFiles {
  read(assignmentId: string, path: string): Promise<WorkspaceFile>;
  write(assignmentId: string, file: WorkspaceFile): Promise<void>;
  search(assignmentId: string, query: string): Promise<readonly WorkspaceFile[]>;
}

export { AssignmentFiles } from './workspace.js';
