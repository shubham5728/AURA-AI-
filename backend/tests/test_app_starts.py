"""The app imports, and every route it claims is actually mounted.

Written after adding a router to main.py without importing it. The whole suite
passed -- 185 tests, all green -- while the server could not start at all,
because nothing in the suite ever imported the application itself.

Unit tests over pure functions cannot catch a wiring mistake. This is the
cheapest possible check that the thing as a whole is assembled.
"""

import pytest


def test_application_imports():
    """A missing import in main.py fails here rather than at startup."""
    from app.main import app

    assert app is not None


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/health"),
        ("GET", "/api/me"),
        ("GET", "/api/profile"),
        ("PUT", "/api/profile"),
        ("GET", "/api/twin/context"),
        ("POST", "/api/reports"),
        ("GET", "/api/reports"),
        ("GET", "/api/reports/trends"),
        ("GET", "/api/score"),
        ("POST", "/api/simulate"),
        ("GET", "/api/logs"),
        ("POST", "/api/medications"),
        ("GET", "/api/medications/interactions"),
        ("POST", "/api/chat"),
        ("GET", "/api/chat/history"),
        ("GET", "/api/chat/roles"),
        ("GET", "/api/family"),
        ("POST", "/api/family"),
        ("GET", "/api/family/hereditary"),
        ("GET", "/api/family/trackable-conditions"),
    ],
)
def test_route_is_mounted(method, path):
    """Each route the frontend depends on exists on the running app."""
    from app.main import app

    mounted = {
        (verb, route.path)
        for route in app.routes
        for verb in getattr(route, "methods", set())
    }
    assert (method, path) in mounted


def test_every_router_module_is_included():
    """A router file that exists but was never wired up is dead code.

    Catches the other half of the mistake: importing a module and forgetting
    the include_router call.
    """
    from app.main import app
    from app.routers import chat, family, logs, profile, reports, score, simulate

    mounted_paths = {getattr(r, "path", "") for r in app.routes}
    for module in (chat, family, logs, profile, reports, score, simulate):
        paths = {r.path for r in module.router.routes}
        assert paths & mounted_paths, f"{module.__name__} is not mounted"
