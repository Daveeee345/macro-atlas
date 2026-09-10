from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    assert client.get('/health').json()['status'] == 'ok'


def test_countries():
    r = client.get('/api/countries')
    assert r.status_code == 200
    assert len(r.json()) == 8


def test_historical_period():
    r = client.get('/api/countries/IDN?period=2020-Q2')
    assert r.status_code == 200
    assert r.json()['metrics']['gdp_growth']['period'] <= '2020-Q2'


def test_compare():
    r = client.get('/api/compare?left=IDN&right=USA')
    assert r.status_code == 200
    assert len(r.json()['rows']) == 7
