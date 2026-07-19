"""A record of what actually happened while answering one message.

Every stage of the pipeline already existed; none of it was observable. The
orchestrator decided a role, assembled a context slice, screened the input and
generated a reply, and the caller learned only the final text.

This makes that work inspectable. It is not instrumentation added for a demo --
it is the same claim the product makes ("specialist roles, narrow context, safety
before generation") turned into something a person can verify while using it.

Two rules:

**Measured, not narrated.** Every duration here is a real elapsed time. Nothing
is estimated, and no stage appears unless it ran.

**Safe to show.** The context recorded is the de-identified text that was
actually sent -- the same bytes the model received. Showing it is the point: it
is how someone confirms their name never left the server. Matching regexes are
deliberately not exposed, since publishing the exact emergency patterns tells a
determined user how to word around them.
"""

import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class Stage:
    """One step of the pipeline, with what it decided and how long it took."""

    name: str
    label: str
    ms: float
    detail: str
    # Anything worth showing under the stage -- scores, section names, counts.
    data: Optional[dict] = None

    def as_dict(self) -> dict:
        return {
            "name": self.name,
            "label": self.label,
            "ms": round(self.ms, 1),
            "detail": self.detail,
            "data": self.data or {},
        }


@dataclass
class Trace:
    stages: List[Stage] = field(default_factory=list)
    # The exact de-identified text handed to the model.
    context_sent: str = ""
    system_prompt: str = ""
    total_ms: float = 0.0

    def as_dict(self) -> dict:
        return {
            "stages": [s.as_dict() for s in self.stages],
            "context_sent": self.context_sent,
            "system_prompt": self.system_prompt,
            "total_ms": round(self.total_ms, 1),
        }


class Timer:
    """Records elapsed time per stage.

    Used as a context manager so a stage cannot be recorded without having been
    timed, and so an exception still leaves the trace consistent.
    """

    def __init__(self) -> None:
        self.trace = Trace()
        self._started = time.perf_counter()

    def stage(self, name: str, label: str) -> "_StageTimer":
        return _StageTimer(self, name, label)

    def finish(self) -> Trace:
        self.trace.total_ms = (time.perf_counter() - self._started) * 1000
        return self.trace


class _StageTimer:
    def __init__(self, timer: Timer, name: str, label: str):
        self._timer = timer
        self._name = name
        self._label = label
        self.detail = ""
        self.data: Dict = {}

    def __enter__(self) -> "_StageTimer":
        self._start = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        elapsed = (time.perf_counter() - self._start) * 1000
        # Recorded even when the stage raised: a failed step is part of what
        # happened, and hiding it would make the trace a highlight reel.
        self._timer.trace.stages.append(
            Stage(
                name=self._name,
                label=self._label,
                ms=elapsed,
                detail=self.detail or ("failed" if exc else ""),
                data=self.data,
            )
        )
