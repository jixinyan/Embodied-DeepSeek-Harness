import asyncio
from typing import Any
from physical_harness.execution.action_gate import ActionGate
from physical_harness.policies import SubgoalPolicy


class PolicyRollout:
    def __init__(self, policy: SubgoalPolicy, gate: ActionGate) -> None:
        self.policy, self.gate = policy, gate
        self._active = False

    async def step(self, instruction: str, observation_id: str, observation: dict[str, Any], *, observed_monotonic: float) -> dict[str, Any]:
        if self._active:
            raise RuntimeError("A rollout step is already active.")
        self._active = True
        try:
            request = self.gate.request(instruction, observation_id, observation, observed_monotonic=observed_monotonic)
            async with asyncio.timeout(self.gate.ticket_remaining_time()):
                chunk = await self.policy.infer(request)
                return await self.gate.execute(chunk)
        except BaseException as error:
            if self.gate.snapshot()["state"] == "running":
                await self.gate.stop_after_failure(error)
            raise
        finally:
            self._active = False

    async def close(self) -> None:
        errors: list[BaseException] = []
        try:
            await self.gate.pause("user_stop", terminal=True)
        except BaseException as error:
            errors.append(error)
        try:
            await self.policy.close()
        except BaseException as error:
            errors.append(error)
        if len(errors) == 1:
            raise errors[0]
        if errors:
            raise BaseExceptionGroup("Policy rollout shutdown failed.", errors)
