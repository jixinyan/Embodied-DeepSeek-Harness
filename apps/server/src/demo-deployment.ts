import { resolve } from 'node:path';
import type { ContractValidator } from '@edh/contracts';
import type { ServerDeployment, LaunchProfile } from './deployment.js';
import { FixtureModel } from './fixture-model.js';
import {
  FixtureBackend,
  FIXTURE_GOAL,
  MULTI_GOAL_FIXTURE,
  FIXTURE_SUBGOAL_CHECKS,
  type FixtureScenario,
} from './fixture-backend.js';

export interface DemoDeploymentOptions {
  root: string;
  teamFile?: string;
  tickMs?: number;
  modelDelayMs?: number;
}
export function createDemoDeployment(
  options: DemoDeploymentOptions,
  validator: ContractValidator,
): ServerDeployment {
  const labels: Record<FixtureScenario, string> = {
    'retry-success': 'Failure → recovery → success',
    'multi-goal-recovery': 'Placement → access repair → storage',
    'first-pass': 'First-attempt success',
    unknown: 'Insufficient evidence',
    'backend-error': 'Backend error',
  };
  return {
    id: 'cpu-console-demo',
    version: '1',
    source: 'test_fixture',
    description: 'CPU fixture · No live model, simulator or robot connected',
    teamFile: options.teamFile ?? resolve(options.root, 'examples/teams/console-demo.yaml'),
    roleRoot: resolve(options.root, 'examples'),
    defaultModel: 'fixture',
    models: { fixture: { provider: 'fixture', model: 'fixture' } },
    adapters: [{ providers: ['fixture'], adapter: new FixtureModel(options.modelDelayMs ?? 140) }],
    tasks: Object.fromEntries(
      Object.entries(labels).map(([id, label]) => [
        id,
        {
          label,
          instruction:
            id === 'multi-goal-recovery'
              ? 'Store the cup inside the cabinet and close the cabinet.'
              : 'Place the cup inside the cabinet.',
          goal: id === 'multi-goal-recovery' ? MULTI_GOAL_FIXTURE : FIXTURE_GOAL,
          allowedSubgoalChecks: FIXTURE_SUBGOAL_CHECKS,
          createBackend: () =>
            new FixtureBackend(validator, id as FixtureScenario, options.tickMs ?? 650),
        },
      ]),
    ),
  };
}

/** CPU-only environment continuity fixture. Each task gets a fresh control scope. */
export function createDemoLaunchProfiles(
  validator: ContractValidator,
  tickMs = 650,
): Record<string, LaunchProfile> {
  return {
    'persistent-cup-fixture': {
      label: 'Persistent cup workspace',
      environment: 'CPU cup fixture',
      embodiment: 'Synthetic robot',
      policy: 'Scripted CPU policy',
      checkpoint: 'none (test fixture)',
      defaultModel: 'fixture',
      tasks: ['first-pass', 'retry-success', 'multi-goal-recovery', 'unknown', 'backend-error'],
      createEnvironment: () => {
        const world = { inside: false, cabinetOpen: false, view: 'center' };
        let closed = false;
        const ports = new Set<FixtureBackend>();
        return {
          createTaskBackend: (taskId, { signal }) => {
            signal.throwIfAborted();
            if (closed) throw new Error('Fixture environment is closed.');
            const port = new FixtureBackend(
              validator,
              taskId as FixtureScenario,
              tickMs,
              world,
              true,
            );
            ports.add(port);
            const close = port.close.bind(port);
            port.close = async () => {
              await close();
              ports.delete(port);
            };
            return port;
          },
          close: async () => {
            closed = true;
            for (const port of ports) {
              await port.stop();
              await port.close();
            }
          },
        };
      },
    },
  };
}
