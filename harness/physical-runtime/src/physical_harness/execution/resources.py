from __future__ import annotations

from hashlib import sha256
from pathlib import Path
from threading import Lock

from filelock import FileLock, Timeout


class ResourceBusy(RuntimeError):
    pass


class ResourceLease:
    def __init__(self, locks: list[FileLock]) -> None:
        self._locks = locks
        self._guard = Lock()
        self._active = True

    def valid(self) -> bool:
        with self._guard:
            return self._active

    def release(self) -> None:
        with self._guard:
            if not self._active:
                return
            for lock in reversed(self._locks):
                lock.release()
            self._active = False


class ResourceArbiter:
    def __init__(self, directory: Path, scope: str) -> None:
        if not directory.is_absolute() or not isinstance(scope, str) or not scope.strip():
            raise ValueError("Resource arbitration requires an absolute directory and nonempty scope.")
        directory.mkdir(parents=True, exist_ok=True)
        self._directory = directory
        self._scope = scope

    def acquire(self, resources: tuple[str, ...]) -> ResourceLease:
        if not resources or any(not isinstance(resource, str) or not resource.strip() for resource in resources):
            raise ValueError("Physical operations require named resources.")
        if len(resources) != len(set(resources)):
            raise ValueError("Physical resource names must be unique.")
        locks: list[FileLock] = []
        try:
            for resource in sorted(resources):
                identity = sha256((self._scope + "\0" + resource).encode()).hexdigest()
                lock = FileLock(self._directory / f"{identity}.lock", thread_local=False)
                lock.acquire(timeout=0)
                locks.append(lock)
        except BaseException as error:
            for lock in reversed(locks):
                lock.release()
            if isinstance(error, Timeout):
                raise ResourceBusy(f"Physical resource is already owned: {resource}") from error
            raise
        return ResourceLease(locks)
