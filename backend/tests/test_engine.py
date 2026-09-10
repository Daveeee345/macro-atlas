from app.analytics.engine import percentile_rank, real_policy_rate, regime, spread


def test_percentile_rank():
    assert percentile_rank([1, 2, 3, 4, 5], 5) == 90.0
    assert percentile_rank([1, 2, 3, 4, 5], 3) == 50.0


def test_real_policy_rate():
    assert real_policy_rate(5.0, 2.3) == 2.7


def test_regime():
    assert regime(68, 42) == "EXPANSION"
    assert regime(68, 72) == "OVERHEATING"
    assert regime(30, 72) == "STAGFLATION"
    assert regime(30, 20) == "SLOWDOWN"


def test_spread():
    assert spread(5.0, 3.5) == 1.5
