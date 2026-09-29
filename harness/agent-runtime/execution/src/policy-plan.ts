import { z } from 'zod';

const text = z.string().trim().min(1).max(2000);
const reach = z.enum(['yes', 'no', 'unknown']);
const arm = z.enum(['left', 'right']);
const subtask = z
  .object({
    id: text,
    status: z.enum(['pending', 'ready', 'in_progress', 'blocked', 'done']),
    src: text,
    dst: text,
    cond: text,
    next_action: text,
    evidence: text,
    arm_plan: z.enum(['single', 'handoff', 'coordinated_dual']),
    arms_used: z.array(arm).min(1).max(2),
    simultaneous_arms: z.number().int().min(1).max(2),
    reachability: z
      .object({ 'left.src': reach, 'left.dst': reach, 'right.src': reach, 'right.dst': reach })
      .strict(),
    depends_on: z.array(text).max(64),
  })
  .strict();
export type PolicySubtask = z.infer<typeof subtask>;

export function validatePolicyPlan(input: unknown): PolicySubtask[] {
  const plan = z.array(subtask).min(1).max(64).parse(input);
  const entries = new Map(plan.map((task) => [task.id, task]));
  if (entries.size !== plan.length) throw new Error('Subtask IDs must be unique.');
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    const task = entries.get(id);
    if (!task || visiting.has(id)) throw new Error('Dependencies must exist and be acyclic.');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of task.depends_on) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const task of plan) {
    const arms = new Set(task.arms_used);
    if (
      arms.size !== task.arms_used.length ||
      (task.arm_plan === 'single' ? arms.size !== 1 : arms.size !== 2) ||
      task.simultaneous_arms !== (task.arm_plan === 'coordinated_dual' ? 2 : 1) ||
      new Set(task.depends_on).size !== task.depends_on.length
    )
      throw new Error('Invalid subtask arm assignment or dependencies.');
    visit(task.id);
    if (
      ['ready', 'in_progress', 'done'].includes(task.status) &&
      task.depends_on.some((id) => entries.get(id)?.status !== 'done')
    )
      throw new Error('Subtask prerequisites must be completed.');
  }
  return plan;
}

export const armReview = z
  .object({
    subtask_id: text.nullable(),
    confidence: z.enum(['low', 'medium', 'high']),
    evidence: text,
    grounding_ids: z.array(text).max(64),
  })
  .strict();
export const intentReview = z
  .object({
    left: armReview,
    right: armReview,
    failure_detected: z.boolean(),
    path_unsafe: z.boolean(),
    dependency_violation: z.boolean(),
  })
  .strict();

export function validatePolicyIntent(
  input: unknown,
  decision: 'allow' | 'intervene',
  plan: readonly PolicySubtask[],
  groundingIds: ReadonlySet<string>,
) {
  const review = intentReview.parse(input);
  const selected = [];
  for (const side of ['left', 'right'] as const) {
    const item = review[side];
    if (item.grounding_ids.some((id) => !groundingIds.has(id)))
      throw new Error('Grounding references require the current observation.');
    const task = plan.find((task) => task.id === item.subtask_id);
    if (item.subtask_id !== null && !task) throw new Error('Unknown reviewed subtask.');
    if (decision === 'allow') {
      if (
        !task ||
        item.confidence === 'low' ||
        !task.arms_used.includes(side) ||
        !['ready', 'in_progress'].includes(task.status)
      )
        throw new Error(
          'Allowed intent requires a ready assigned subtask and sufficient evidence.',
        );
      selected.push(task);
    }
  }
  if (
    decision === 'allow' &&
    (review.failure_detected || review.path_unsafe || review.dependency_violation)
  )
    throw new Error('Failure, unsafe path or dependency violation requires intervention.');
  if (
    selected.length === 2 &&
    selected[0]!.id === selected[1]!.id &&
    selected[0]!.arm_plan !== 'coordinated_dual'
  )
    throw new Error('A simultaneous shared subtask requires coordinated_dual.');
  return review;
}
