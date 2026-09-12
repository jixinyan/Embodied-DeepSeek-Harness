"""Real localhost sockets and generation-fenced CPU devices; no learned robotics claims."""
import asyncio
import copy
import importlib.util
import json
from pathlib import Path
import time
import unittest

from physical_harness.validation import ContractValidator
from physical_harness.execution.action_gate import ActionGate, GateRejected
from physical_harness.execution.policy_rollout import PolicyRollout
from physical_harness.policies.client import WebSocketPolicyClient, PolicyProtocolError
from physical_harness.policies.server import serve_policy

ROOT = Path(__file__).resolve().parents[3]
VALIDATOR = ContractValidator.from_path(ROOT / 'harness/contracts/schema/physical.schema.json')
BASES = json.loads((ROOT / 'tests/contracts/wire-cases.json').read_text())['bases']


def chunk(request, count=1):
    result = {k: copy.deepcopy(request[k]) for k in ('request_id', 'execution_id', 'task_scope', 'generation', 'observation_id', 'valid_until', 'action_spec')}
    return dict(result, schema_version='physical.action_chunk.v1', actions=[[0.2]] * count)


class Device:
    def __init__(self):
        self.actions = []
        self.generation = 0
        self.stopped = False
        self.confirmed = True
        self.on_dispatch = None
        self.resume_failure = False

    async def dispatch(self, segment):
        count = 0
        if segment['generation'] == self.generation and not self.stopped:
            self.actions.extend(segment['actions'])
            count = len(segment['actions'])
        if self.on_dispatch:
            await self.on_dispatch()
        return dict(schema_version='physical.action_receipt.v1', execution_id=segment['execution_id'], generation=segment['generation'], segment_id=segment['segment_id'], executed_actions=count)

    async def stop(self, execution_id, generation):
        self.generation, self.stopped = generation, True
        ack = dict(schema_version='physical.stop_ack.v1', execution_id=execution_id, generation=generation, device_confirmed=self.confirmed)
        if self.confirmed:
            ack['boundary_id'] = f'boundary:{generation}'
        return ack

    async def resume(self, execution_id, generation):
        if generation != self.generation:
            return False
        self.stopped = False
        if self.resume_failure:
            raise TimeoutError('Resume acknowledgement lost')
        return True


def gate(device=None, **kwargs):
    options = dict(execution_id='exec1', task_scope=BASES['policy_request']['value']['task_scope'], action_spec=BASES['action']['value'], max_control_steps=32, max_wall_time_s=10, lease_valid=lambda: True, observation_ttl_s=5)
    options.update(kwargs)
    return ActionGate(VALIDATOR, device or Device(), **options)


def request(g):
    return g.request('Move the joint', 'obs1', {'joints': [0]}, observed_monotonic=time.monotonic())


class GateTests(unittest.IsolatedAsyncioTestCase):
    async def test_pause_after_five_discards_rest_of_sixteen(self):
        d = Device(); g = gate(d)
        async def monitor():
            if len(d.actions) == 5:
                await g.pause()
        d.on_dispatch = monitor
        result = await g.execute(chunk(request(g), 16))
        self.assertEqual(len(d.actions), 5)
        self.assertEqual(result['state'], 'paused')
        self.assertTrue(result['device_confirmed'])
        await g.resume()
        await g.execute(chunk(request(g)))
        self.assertEqual(len(d.actions), 6)

    async def test_old_replaced_duplicate_and_invalid_chunks_never_dispatch(self):
        d = Device(); g = gate(d)
        old = chunk(request(g)); current = chunk(request(g))
        with self.assertRaises(PolicyProtocolError): await g.execute(old)
        for field, value in [('generation', 3), ('task_scope', dict(task_id='t2', goal_id='g1', attempt_id='a1')), ('actions', [[2]]), ('actions', [[0, 0]])]:
            bad = copy.deepcopy(current); bad[field] = value
            with self.assertRaises(PolicyProtocolError): await g.execute(bad)
        self.assertEqual(d.actions, [])
        await g.execute(current)
        with self.assertRaises(GateRejected): await g.execute(current)
        self.assertEqual(len(d.actions), 1)
        late = chunk(request(g)); await g.pause(); await g.resume()
        with self.assertRaises(GateRejected): await g.execute(late)

    async def test_unconfirmed_stop_and_stale_ack_block_resume(self):
        d = Device(); d.confirmed = False; g = gate(d)
        status = await g.pause()
        self.assertEqual(status['state'], 'pausing')
        with self.assertRaises(GateRejected): await g.resume()
        ack = dict(BASES['stop_ack']['value']); ack['generation'] = 0
        with self.assertRaises(GateRejected): g.confirm_stop(ack)
        ack['generation'] = 1; g.confirm_stop(ack)
        await g.resume()
        self.assertEqual(g.snapshot()['state'], 'running')

    async def test_lost_resume_ack_requires_new_stop(self):
        d = Device(); g = gate(d); await g.pause()
        d.resume_failure = True; d.confirmed = False
        with self.assertRaises(TimeoutError): await g.resume()
        status = g.snapshot()
        self.assertEqual(status['generation'], 2)
        self.assertFalse(status['device_confirmed'])
        self.assertEqual(status['state'], 'pausing')
        with self.assertRaises(GateRejected): request(g)

    async def test_budget_stop_is_not_success(self):
        d = Device(); g = gate(d, max_control_steps=3)
        result = await g.execute(chunk(request(g), 3))
        self.assertEqual(result['stop_reason'], 'budget_exhausted')
        self.assertEqual(result['state'], 'ended')
        self.assertTrue(result['device_confirmed'])
        with self.assertRaises(GateRejected): await g.resume()

    async def test_expiry_and_lease_loss_reject_before_dispatch(self):
        now = [10.0]; owned = [True]; d = Device()
        g = gate(d, clock=lambda: now[0], lease_valid=lambda: owned[0])
        r = g.request('Move', 'obs1', {}, observed_monotonic=10)
        owned[0] = False
        with self.assertRaises(GateRejected): await g.execute(chunk(r))
        owned[0] = True; now[0] = 16
        with self.assertRaises(GateRejected): await g.execute(chunk(r))
        self.assertEqual(d.actions, [])

    async def test_uncertain_dispatch_stays_charged_and_stops(self):
        d = Device(); g = gate(d)
        async def fail(): raise TimeoutError('Receipt lost')
        d.on_dispatch = fail
        with self.assertRaises(TimeoutError): await g.execute(chunk(request(g), 8))
        self.assertEqual(g.snapshot()['reserved_actions'], 1)
        self.assertEqual(g.snapshot()['executed_actions'], 0)
        self.assertTrue(d.stopped)
        self.assertEqual(len(d.actions), 1)

    async def test_pause_during_resume_cannot_reopen_old_generation(self):
        d = Device(); g = gate(d); await g.pause()
        entered = asyncio.Event(); release = asyncio.Event()
        original = d.resume
        async def delayed(execution_id, generation):
            entered.set(); await release.wait()
            return await original(execution_id, generation)
        d.resume = delayed
        pending = asyncio.create_task(g.resume())
        await entered.wait(); await g.pause(); release.set()
        with self.assertRaises(GateRejected): await pending
        self.assertTrue(d.stopped)
        self.assertEqual(g.snapshot()['state'], 'paused')
        self.assertEqual(g.snapshot()['generation'], 2)

    async def test_pause_while_dispatch_in_flight_requires_drain(self):
        d = Device(); g = gate(d)
        entered = asyncio.Event(); release = asyncio.Event()
        async def blocked(): entered.set(); await release.wait()
        d.on_dispatch = blocked
        pending = asyncio.create_task(g.execute(chunk(request(g), 16)))
        await entered.wait(); await g.pause()
        with self.assertRaises(GateRejected): await g.resume()
        release.set(); await pending
        self.assertEqual(len(d.actions), 1)
        await g.resume()

    async def test_close_releases_policy_even_when_stop_fails(self):
        d = Device(); g = gate(d)
        async def failed_stop(*args): raise OSError('Device unavailable')
        d.stop = failed_stop
        class Policy:
            closed = False
            async def close(self): self.closed = True
        p = Policy()
        with self.assertRaises(OSError): await PolicyRollout(p, g).close()
        self.assertTrue(p.closed)
        self.assertEqual(g.snapshot()['state'], 'pausing')
        self.assertFalse(g.snapshot()['device_confirmed'])


@unittest.skipUnless(importlib.util.find_spec('websockets'), 'Install the policy extra for socket acceptance')
class SocketTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.servers = []; self.clients = []

    async def asyncTearDown(self):
        for c in self.clients: await c.close()
        for s in self.servers: s.close()
        for s in self.servers: await s.wait_closed()

    async def connect(self, infer, *, key=None, timeout=1):
        server = await serve_policy(infer, VALIDATOR, api_key=key)
        self.servers.append(server)
        uri = f'ws://127.0.0.1:{server.sockets[0].getsockname()[1]}'
        client = WebSocketPolicyClient(uri, VALIDATOR, api_key=key, timeout_s=timeout)
        self.clients.append(client)
        return client, uri

    async def test_socket_to_gate_to_device_budget(self):
        async def infer(r): return [[0.2]] * r['max_actions']
        client, _ = await self.connect(infer, key='test-key')
        d = Device(); g = gate(d, max_control_steps=4)
        rollout = PolicyRollout(client, g)
        status = await rollout.step('Move', 'obs1', {}, observed_monotonic=time.monotonic())
        self.assertEqual(len(d.actions), 4)
        self.assertEqual(status['stop_reason'], 'budget_exhausted')
        await rollout.close()

    async def test_pause_during_inference_rejects_late_chunk_after_resume(self):
        entered = asyncio.Event(); release = asyncio.Event()
        async def infer(r): entered.set(); await release.wait(); return [[0.2]]
        client, _ = await self.connect(infer)
        d = Device(); g = gate(d)
        pending = asyncio.create_task(client.infer(request(g)))
        await entered.wait(); await g.pause(); await g.resume(); release.set()
        late = await pending
        with self.assertRaises(GateRejected): await g.execute(late)
        self.assertEqual(d.actions, [])

    async def test_timeout_discards_connection_and_does_not_replay(self):
        calls = []
        async def infer(r):
            calls.append(r['request_id'])
            if len(calls) == 1: await asyncio.sleep(0.12)
            return [[0.2]]
        client, _ = await self.connect(infer, timeout=0.05)
        g = gate()
        with self.assertRaises(TimeoutError): await client.infer(request(g))
        result = await client.infer(request(g))
        self.assertEqual(result['request_id'], calls[1])
        self.assertEqual(len(calls), 2)

    async def test_wall_budget_interrupts_slow_inference(self):
        async def infer(r): await asyncio.sleep(0.15); return [[0.2]]
        client, _ = await self.connect(infer)
        d = Device(); g = gate(d, max_wall_time_s=0.04)
        with self.assertRaises(TimeoutError):
            await PolicyRollout(client, g).step('Move', 'obs1', {}, observed_monotonic=time.monotonic())
        self.assertTrue(d.stopped)
        self.assertEqual(g.snapshot()['stop_reason'], 'budget_exhausted')
        self.assertEqual(d.actions, [])

    async def test_concurrency_and_close_cancel_pending_request(self):
        entered = asyncio.Event()
        async def infer(r): entered.set(); await asyncio.sleep(0.1); return [[0.2]]
        client, _ = await self.connect(infer)
        g = gate(); pending = asyncio.create_task(client.infer(request(g)))
        await entered.wait()
        with self.assertRaises(RuntimeError): await client.infer(request(g))
        await client.close()
        self.assertTrue(pending.cancelled())
        with self.assertRaises(RuntimeError): await client.infer(request(g))

    async def test_auth_and_bad_server_output(self):
        async def infer(r): return [[99]]
        client, uri = await self.connect(infer, key='test-key')
        wrong = WebSocketPolicyClient(uri, VALIDATOR, api_key='wrong'); self.clients.append(wrong)
        from websockets.exceptions import InvalidStatus
        with self.assertRaises(InvalidStatus): await wrong.infer(request(gate()))
        with self.assertRaises(PolicyProtocolError): await client.infer(request(gate()))

    async def test_malformed_and_oversized_response(self):
        from websockets.asyncio.server import serve
        from websockets.exceptions import ConnectionClosed
        for response in ['{"actions":[],"actions":[]}', 'x' * 4096]:
            async def handler(ws):
                await ws.recv(); await ws.send(response)
            server = await serve(handler, '127.0.0.1', 0); self.servers.append(server)
            client = WebSocketPolicyClient(f'ws://127.0.0.1:{server.sockets[0].getsockname()[1]}', VALIDATOR, max_bytes=2048)
            self.clients.append(client)
            with self.assertRaises((PolicyProtocolError, ConnectionClosed)):
                await client.infer(request(gate()))
