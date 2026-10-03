import asyncio
from dataclasses import replace
import json
import multiprocessing
from pathlib import Path
import shutil
from threading import Event
import time
import unittest
from uuid import uuid4

from physical_harness.backends.hardware import HardwareCapabilities
from physical_harness.execution.resources import ResourceArbiter, ResourceBusy
from physical_harness.execution.watchdog import ExecutionWatchdog
from physical_harness.validation import ContractValidator


ROOT = Path(__file__).resolve().parents[3]
VALIDATOR = ContractValidator.from_path(ROOT / "harness/contracts/schema/physical.schema.json")
ACTION_SPEC = json.loads((ROOT / "tests/contracts/wire-cases.json").read_text())["bases"]["action"]["value"]


def compete_for_resource(directory: str, scope: str, output) -> None:
    arbiter = ResourceArbiter(Path(directory), scope)
    try:
        lease = arbiter.acquire(("arm",))
    except ResourceBusy:
        output.put("busy")
    else:
        lease.release()
        output.put("acquired")


class ResourceChecks(unittest.TestCase):
    def setUp(self):
        self.directory = ROOT / ".local" / "runtime-safety-checks" / str(uuid4())
        self.arbiter = ResourceArbiter(self.directory, "device-1")

    def tearDown(self):
        shutil.rmtree(self.directory)

    def test_actual_process_exclusion_and_release(self):
        lease = self.arbiter.acquire(("arm",))
        context = multiprocessing.get_context("spawn")
        output = context.Queue()
        process = context.Process(target=compete_for_resource, args=(str(self.directory), "device-1", output))
        process.start()
        self.assertEqual(output.get(timeout=10), "busy")
        process.join(timeout=10)
        self.assertEqual(process.exitcode, 0)
        lease.release()
        self.assertFalse(lease.valid())
        process = context.Process(target=compete_for_resource, args=(str(self.directory), "device-1", output))
        process.start()
        self.assertEqual(output.get(timeout=10), "acquired")
        process.join(timeout=10)
        self.assertEqual(process.exitcode, 0)
        output.close()

    def test_partial_acquisition_is_released(self):
        base = self.arbiter.acquire(("base",))
        with self.assertRaises(ResourceBusy):
            self.arbiter.acquire(("arm", "base"))
        arm = self.arbiter.acquire(("arm",))
        arm.release()
        base.release()

    def test_isolated_device_scopes_run_concurrently(self):
        first = self.arbiter.acquire(("arm",))
        second = ResourceArbiter(self.directory, "device-2").acquire(("arm",))
        first.release()
        second.release()

    def test_invalid_resource_admission(self):
        for resources in ((), ("",), ("arm", "arm")):
            with self.assertRaises(ValueError):
                self.arbiter.acquire(resources)


class WatchdogChecks(unittest.IsolatedAsyncioTestCase):
    async def test_fences_while_asyncio_owner_is_blocked(self):
        fenced, notified = Event(), Event()
        reasons = []

        def notify(reason):
            self.assertTrue(fenced.is_set())
            reasons.append(reason)
            notified.set()

        # 有效租约由独立事件表示，事件循环暂停期间由监控线程执行检查。
        alive = Event()
        alive.set()
        watchdog = ExecutionWatchdog(deadline=time.monotonic() + 0.05, lease_valid=alive.is_set,
                                     fence=fenced.set, notify=notify)
        watchdog.start()
        try:
            time.sleep(0.12)
            self.assertTrue(fenced.is_set())
            self.assertTrue(notified.is_set())
            self.assertEqual(reasons, ["budget_exhausted"])
        finally:
            watchdog.close()

    async def test_lease_loss_precedes_later_deadline(self):
        alive, fenced, notified = Event(), Event(), Event()
        alive.set()
        reasons = []

        def notify(reason):
            reasons.append(reason)
            notified.set()

        watchdog = ExecutionWatchdog(deadline=time.monotonic() + 10, lease_valid=alive.is_set,
                                     fence=fenced.set, notify=notify)
        watchdog.start()
        try:
            alive.clear()
            self.assertTrue(await asyncio.to_thread(notified.wait, 1))
            self.assertTrue(fenced.is_set())
            self.assertEqual(reasons, ["backend_error"])
        finally:
            watchdog.close()

    async def test_disarmed_watchdog_has_no_future_effect(self):
        fenced = Event()
        watchdog = ExecutionWatchdog(deadline=time.monotonic() + 0.1, lease_valid=lambda: True,
                                     fence=fenced.set, notify=lambda reason: fenced.set())
        watchdog.start()
        watchdog.close()
        await asyncio.sleep(0.15)
        self.assertFalse(fenced.is_set())


class HardwareCapabilityChecks(unittest.TestCase):
    def capabilities(self):
        return HardwareCapabilities(
            device_id="arm-device", embodiment_id=ACTION_SPEC["embodiment_id"], connection_id="connection-1",
            actuator_resources=("arm",), camera_names=("wrist",), state_channels=("joint_position",),
            coordinate_frames=(ACTION_SPEC["coordinate_frame"],), action_spec=ACTION_SPEC,
            supports_pause=True, supports_resume=True, stop_watchdog_timeout_s=0.5,
        )

    def test_declared_hardware_interface_matches_actual_wire_schema(self):
        self.capabilities().validate(VALIDATOR)

    def test_rejects_missing_controller_watchdog(self):
        for timeout in (0, float("inf"), float("nan"), 11, True):
            with self.assertRaises(ValueError):
                replace(self.capabilities(), stop_watchdog_timeout_s=timeout).validate(VALIDATOR)

    def test_rejects_unknown_motion_frame_and_embodiment(self):
        with self.assertRaises(ValueError):
            replace(self.capabilities(), coordinate_frames=("unavailable-frame",)).validate(VALIDATOR)
        with self.assertRaises(ValueError):
            replace(self.capabilities(), embodiment_id="unavailable-body").validate(VALIDATOR)

    def test_rejects_duplicate_resources_and_unsupported_resume(self):
        with self.assertRaises(ValueError):
            replace(self.capabilities(), actuator_resources=("arm", "arm")).validate(VALIDATOR)
        with self.assertRaises(ValueError):
            replace(self.capabilities(), supports_pause=False).validate(VALIDATOR)
