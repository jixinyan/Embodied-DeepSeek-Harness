export class AssignmentEvidenceGrants {
  private readonly assignments = new Map<string, Set<string>>();
  private closed = false;

  open(assignmentId: string, evidenceIds: readonly string[]): void {
    if (this.closed) throw new Error('Evidence grants are closed.');
    if (this.assignments.has(assignmentId))
      throw new Error('Assignment evidence grants already exist.');
    this.assignments.set(assignmentId, new Set(evidenceIds));
  }

  extend(assignmentId: string, evidenceIds: readonly string[]): void {
    const grants = this.require(assignmentId);
    for (const id of evidenceIds) grants.add(id);
  }

  has(assignmentId: string, evidenceId: string): boolean {
    return this.assignments.get(assignmentId)?.has(evidenceId) ?? false;
  }

  references(assignmentId: string): string[] {
    return [...this.require(assignmentId)];
  }

  release(assignmentId: string): void {
    this.assignments.delete(assignmentId);
  }

  close(): void {
    this.closed = true;
    this.assignments.clear();
  }

  private require(assignmentId: string): Set<string> {
    const grants = this.assignments.get(assignmentId);
    if (!grants) throw new Error('Assignment evidence grants are unavailable.');
    return grants;
  }
}
