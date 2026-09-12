"""A local WebSocket policy -> action gate -> CPU device demonstration.

Run from any directory with the installed physical-runtime policy extra.
This does not load a learned policy, simulator or robot driver.
"""
import asyncio
import json
from pathlib import Path
import time

from physical_harness.execution.action_gate import ActionGate
from physical_harness.execution.policy_rollout import PolicyRollout
from physical_harness.policies.client import WebSocketPolicyClient
from physical_harness.policies.server import serve_policy
from physical_harness.validation import ContractValidator


class CpuDevice:
    """Synthetic device with generation fencing and confirmed action accounting."""
    def __init__(self):
        self.generation, self.stopped, self.position = 0, False, 0.0
        self.executed = 0

    async def dispatch(self, segment):
        # Real adapters must perform this check at the actual command queue boundary.
        count = 0
        if segment['generation'] == self.generation and not self.stopped:
            for action in segment['actions']:
                self.position = action[0]
                self.executed += 1
                count += 1
        return dict(schema_version='physical.action_receipt.v1', execution_id=segment['execution_id'], generation=segment['generation'], segment_id=segment['segment_id'], executed_actions=count)

    async def stop(self, execution_id, generation):
        self.generation, self.stopped = generation, True
        return dict(schema_version='physical.stop_ack.v1', execution_id=execution_id, generation=generation, device_confirmed=True, boundary_id=f'cpu-boundary:{generation}')

    async def resume(self, execution_id, generation):
        if generation != self.generation: return False
        self.stopped = False
        return True


async def main():
    root = Path(__file__).resolve().parents[2]
    validator = ContractValidator.from_path(root / 'harness/contracts/schema/physical.schema.json')
    spec = dict(schema_version='physical.action_spec.v1', embodiment_id='cpu_joint', version='1', coordinate_frame='robot_base', control_mode='joint_position', frequency_hz=20, channels=[dict(name='joint_1', quantity='angular', unit='radian', minimum=-1, maximum=1)])
    async def infer(request):
        # Replace this callback with deployment-owned VLA/VLN inference.
        return [[0.1 * (index + 1)] for index in range(min(4, request['max_actions']))]
    server = await serve_policy(infer, validator)
    client = WebSocketPolicyClient(f'ws://127.0.0.1:{server.sockets[0].getsockname()[1]}', validator)
    device = CpuDevice()
    gate = ActionGate(validator, device, execution_id='cpu-execution', task_scope=dict(task_id='cpu-task', goal_id='move-joint', attempt_id='attempt-1'), action_spec=spec, max_control_steps=4, max_wall_time_s=5, observation_ttl_s=2, lease_valid=lambda: True)
    rollout = PolicyRollout(client, gate)
    try:
        status = await rollout.step('Move the joint toward 0.4 radians', 'cpu-observation', {'joint_position': [device.position]}, observed_monotonic=time.monotonic())
        print(json.dumps({'fixture': 'CPU device, no simulation or learned policy', 'executed_actions': device.executed, 'position_radians': device.position, 'gate': status, 'next_required_step': 'Formal verification by the assigned verifier'}, indent=2))
    finally:
        try:
            await rollout.close()
        finally:
            server.close()
            await server.wait_closed()


if __name__ == '__main__':
    asyncio.run(main())
