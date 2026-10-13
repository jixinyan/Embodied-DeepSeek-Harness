from contextlib import contextmanager
import os
import socket
from typing import Any, Iterator, Sequence


POLICY_LISTEN_BACKLOG = 100


def reserve_policy_sockets(sockets: Sequence[Any]) -> None:
    for bound in sockets:
        with bound.dup() as listener:
            listener.listen(POLICY_LISTEN_BACKLOG)


@contextmanager
def native_policy_listener(port: int) -> Iterator[socket.socket]:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        if os.name == "posix":
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        listener.bind(("127.0.0.1", port))
        listener.listen(POLICY_LISTEN_BACKLOG)
        yield listener
