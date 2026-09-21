import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { ContractValidator, InvocationBrief } from '@edh/contracts';
import type { LocalStore } from '@edh/storage';
import type { RunAssignment, RunState } from './run-state.js';

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$(?![\s\S])/);
const counter = z.number().int().nonnegative().safe();
const assignmentSchema = z
  .object({
    id: identifier,
    member: z.string().min(1),
    sessionId: identifier,
    brief: z.record(z.string(), z.unknown()),
    status: z.enum(['retired', 'retirement_failed']),
    model: z.string().min(1),
    tools: z.array(z.string()),
    verificationContextStored: z.boolean().optional(),
    todos: z
      .array(
        z
          .object({
            content: z.string(),
            status: z.enum(['pending', 'in_progress', 'completed']),
          })
          .strict(),
      )
      .optional(),
    report: z.record(z.string(), z.unknown()).optional(),
    reportVersion: counter.optional(),
    todoSequence: counter.optional(),
    todoTurn: counter.optional(),
    turn: counter.optional(),
    step: counter.optional(),
  })
  .strict();
const archiveSchema = z
  .object({
    format: z.literal('edh.assignment-history.v1'),
    runId: identifier,
    assignment: assignmentSchema,
    lastObservationId: z.string().min(1).optional(),
    stream: z
      .object({
        attemptId: z.string().min(1),
        revision: counter,
        text: z.string(),
        reasoning: z.string(),
        status: z.string(),
      })
      .strict()
      .optional(),
  })
  .strict();
export interface AssignmentDetails {
  format: 'edh.assignment-history.v1';
  runId: string;
  assignment: RunAssignment & { brief: InvocationBrief };
  lastObservationId?: string;
  stream?: NonNullable<RunState['agentStreams']>[string];
}

export class AssignmentHistory {
  constructor(
    private readonly store: LocalStore,
    private readonly validator: ContractValidator,
  ) {}
  private key(runId: string, assignmentId: string): string {
    return `assignment-history:${JSON.stringify([identifier.parse(runId), identifier.parse(assignmentId)])}`;
  }
  private validate(input: unknown, runId: string, assignmentId: string): AssignmentDetails {
    const value = archiveSchema.parse(input);
    const brief = this.validator.parse('InvocationBrief', value.assignment.brief);
    if (
      value.runId !== runId ||
      value.assignment.id !== assignmentId ||
      brief.assignment_id !== assignmentId ||
      brief.task_scope.task_id !== runId
    )
      throw new Error('Archived assignment identity or task scope is inconsistent.');
    const report =
      value.assignment.report === undefined
        ? undefined
        : this.validator.parse('AgentReport', value.assignment.report);
    if (
      report &&
      (report.assignment_id !== assignmentId ||
        report.agent_id !== value.assignment.sessionId ||
        report.team_run_id !== brief.team_run_id ||
        !isDeepStrictEqual(report.task_scope, brief.task_scope))
    )
      throw new Error('Archived report belongs to a different assignment.');
    const fields = value.assignment;
    return {
      format: value.format,
      runId: value.runId,
      assignment: {
        id: fields.id,
        member: fields.member,
        sessionId: fields.sessionId,
        status: fields.status,
        model: fields.model,
        tools: fields.tools,
        ...(fields.verificationContextStored === undefined
          ? {}
          : { verificationContextStored: fields.verificationContextStored }),
        brief,
        ...(report === undefined ? {} : { report }),
        ...(fields.todos === undefined ? {} : { todos: fields.todos }),
        ...(fields.reportVersion === undefined ? {} : { reportVersion: fields.reportVersion }),
        ...(fields.todoSequence === undefined ? {} : { todoSequence: fields.todoSequence }),
        ...(fields.todoTurn === undefined ? {} : { todoTurn: fields.todoTurn }),
        ...(fields.turn === undefined ? {} : { turn: fields.turn }),
        ...(fields.step === undefined ? {} : { step: fields.step }),
      },
      ...(value.lastObservationId === undefined
        ? {}
        : { lastObservationId: value.lastObservationId }),
      ...(value.stream === undefined ? {} : { stream: value.stream }),
    };
  }
  read(runId: string, assignmentId: string): AssignmentDetails | undefined {
    const record = this.store.get(this.key(runId, assignmentId));
    if (!record) return undefined;
    if (record.version !== 1) throw new Error('Archived assignment has been rewritten.');
    return this.validate(record.value, runId, assignmentId);
  }
  retain(state: RunState, assignmentId: string): void {
    const assignment = state.assignments[assignmentId];
    if (!assignment) throw new Error('Unknown assignment.');
    if (assignment.detailsStored) {
      if (!this.read(state.id, assignmentId)) throw new Error('Archived assignment is missing.');
      return;
    }
    const observation = state.agentSeen[assignmentId];
    const stream = state.agentStreams?.[assignmentId];
    const value = this.validate(
      {
        format: 'edh.assignment-history.v1',
        runId: state.id,
        assignment,
        ...(observation ? { lastObservationId: observation.evidence.id } : {}),
        ...(stream ? { stream } : {}),
      },
      state.id,
      assignmentId,
    );
    const prior = this.read(state.id, assignmentId);
    if (prior && !isDeepStrictEqual(prior, value))
      throw new Error('Archived assignment is immutable.');
    if (!prior) this.store.put(this.key(state.id, assignmentId), value, 0);
    if (!isDeepStrictEqual(this.read(state.id, assignmentId), value))
      throw new Error('Archived assignment does not preserve its source.');
    state.assignments[assignmentId] = {
      id: assignment.id,
      member: assignment.member,
      sessionId: assignment.sessionId,
      status: assignment.status,
      model: assignment.model,
      tools: [...assignment.tools],
      detailsStored: true,
      ...(assignment.verificationContextStored === undefined
        ? {}
        : { verificationContextStored: assignment.verificationContextStored }),
      callerAssignmentId: value.assignment.brief.caller_assignment_id,
      ...(value.lastObservationId ? { lastObservationId: value.lastObservationId } : {}),
      ...(assignment.todos ? { todoCount: assignment.todos.length } : {}),
      ...(assignment.turn === undefined ? {} : { turn: assignment.turn }),
      ...(assignment.step === undefined ? {} : { step: assignment.step }),
      ...(assignment.todoSequence === undefined ? {} : { todoSequence: assignment.todoSequence }),
      ...(assignment.todoTurn === undefined ? {} : { todoTurn: assignment.todoTurn }),
    };
    delete state.agentSeen[assignmentId];
    if (state.agentStreams) delete state.agentStreams[assignmentId];
  }
}
