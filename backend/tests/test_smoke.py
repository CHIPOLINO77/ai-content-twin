from app.main import app


def test_app_loads():
    assert app.title == "AI Content Twin"


def test_health_route_exists():
    routes = {route.path for route in app.routes}
    assert "/health" in routes
    assert "/api/chat" in routes
