from dataclasses import dataclass
from typing import Callable, Mapping, Protocol, Sequence


@dataclass(frozen=True)
class NativeEnvironmentDescription:
    provider: str
    embodiment_id: str
    action_spec: Mapping[str, object]
    camera_names: tuple[str, ...]
    state_channels: tuple[str, ...]
    supported_check_ids: tuple[str, ...]
    active_view_directions: tuple[str, ...]


@dataclass(frozen=True)
class NativeObservation:
    observation_id: str
    observed_at: str
    observed_monotonic: float
    images: Mapping[str, bytes]
    state: Mapping[str, tuple[float, ...]]


@dataclass(frozen=True)
class NativeStep:
    observation: NativeObservation
    executed_actions: int
    action_completed: bool
    raw_sim_steps: int
    episode_terminated: bool


@dataclass(frozen=True)
class NativeCheck:
    check_id: str
    value: bool | None
    reason: str | None = None


class NativeEnvironment(Protocol):
    def describe(self) -> NativeEnvironmentDescription: ...
    def reset(self, task_id: str, configuration: Mapping[str, object]) -> NativeObservation: ...
    def bind_task(self, task_id: str) -> None: ...
    def observe(self) -> NativeObservation: ...
    def step(self, action: Sequence[float], should_stop: Callable[[], bool]) -> NativeStep: ...
    def check(self, check_ids: Sequence[str]) -> Sequence[NativeCheck]: ...
    def turn_view(self, direction: str) -> NativeObservation: ...
    def close(self) -> None: ...
