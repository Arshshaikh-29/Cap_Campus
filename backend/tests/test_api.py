import pytest
from fastapi.testclient import TestClient
from backend.api.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_get_filters():
    response = client.get("/api/filters")
    assert response.status_code == 200
    data = response.json()
    assert "categories" in data
    assert "branches" in data
    assert "cities" in data
    assert "Unknown" not in data["cities"]
    assert "Pune" in data["cities"]
    assert "Mumbai" in data["cities"]
    assert "Computer Engineering" in data["branches"]


def test_search_colleges_and_sorting():
    response = client.get("/api/colleges?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert data["total"] >= 350
    assert "results" in data
    assert len(data["results"]) == 5

    # Search by college code (VJTI 3012 and COEP 6006 / 16006)
    res_code = client.get("/api/colleges?search=3012")
    assert res_code.status_code == 200
    codes = [c["college_code"] for c in res_code.json()["results"]]
    assert "3012" in codes

    res_alias = client.get("/api/colleges?search=16006")
    assert res_alias.status_code == 200
    assert any(c["college_code"] == "6006" for c in res_alias.json()["results"])

    # Sort by code
    res_sort = client.get("/api/colleges?sort_by=code&limit=5")
    assert res_sort.status_code == 200
    sorted_codes = [c["college_code"] for c in res_sort.json()["results"]]
    assert sorted_codes == sorted(sorted_codes)


def test_college_details_and_disambiguated_branches():
    # VJTI 3012 must have Computer Engineering, Information Technology, Civil, Mechanical, Electrical, E&TC
    res_vjti = client.get("/api/colleges/3012")
    assert res_vjti.status_code == 200
    vjti = res_vjti.json()
    assert vjti["city"] == "Mumbai"
    for expected_branch in [
        "Computer Engineering",
        "Information Technology",
        "Civil Engineering",
        "Mechanical Engineering",
        "Electrical Engineering",
        "Electronics and Telecommunication Engg",
    ]:
        assert expected_branch in vjti["branches"]

    # COEP works with both 6006 and 16006
    res_coep = client.get("/api/colleges/16006")
    assert res_coep.status_code == 200
    coep = res_coep.json()
    assert coep["college_code"] == "6006"
    assert coep["city"] == "Pune"
    assert "Computer Engineering" in coep["branches"]


def test_predict_validation():
    response = client.post("/api/predict", json={"category": "GOPENS"})
    assert response.status_code == 400


def test_predict_percentile_and_rank():
    # Top percentile should include VJTI, COEP, PICT, SPIT Computer Engineering
    response = client.post(
        "/api/predict",
        json={
            "category": "GOPENS",
            "percentile": 99.6,
            "branch": "Computer Engineering",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["count"] > 40
    codes = {p["college_code"] for p in data["predictions"]}
    assert {"3012", "6006", "6271", "3215"}.issubset(codes)

    # Rank-based prediction with round filter
    res_rank = client.post(
        "/api/predict",
        json={
            "category": "GOBCS",
            "rank": 15000,
            "city": "Pune",
            "round_number": 1,
        },
    )
    assert res_rank.status_code == 200
    rank_data = res_rank.json()
    assert rank_data["count"] > 10
    assert all(p["round"] == 1 for p in rank_data["predictions"])


def test_compare_colleges():
    response = client.post(
        "/api/compare",
        json={
            "college_codes": ["3012", "6006", "6271", "6141"],
            "category": "GOPENS",
            "year": 2025,
            "round_number": 3,
        },
    )
    assert response.status_code == 200
    comp = response.json()["comparison"]
    assert len(comp) > 15
    returned_colleges = {r["college_code"] for r in comp}
    # All 4 colleges (including non-autonomous 6141 via category fallback) must return comparison rows
    assert {"3012", "6006", "6271", "6141"}.issubset(returned_colleges)


def test_analytics_endpoints():
    res_opt = client.get("/api/analytics/options?college_code=6271")
    assert res_opt.status_code == 200
    opt = res_opt.json()
    branch_names = [b["name"] for b in opt["branches"]]
    assert "Computer Engineering" in branch_names

    res_cut = client.get(
        "/api/analytics/cutoffs?college_code=6271&branch=Computer+Engineering&category=GOPENS"
    )
    assert res_cut.status_code == 200
    cut = res_cut.json()
    assert len(cut["trends"]) >= 6
    assert cut["summary"] is not None
    assert cut["summary"]["latest"]["percentile"] > 99.0
    assert len(cut["branch_comparison"]) >= 4
    assert len(cut["category_comparison"]) >= 5


def test_category_accuracy_and_domain_rules():
    # 1. Minority colleges (e.g. 3199 DJ Sanghvi, 3211 SIES) have no SC/ST/OBC/EWS quota
    # and must not appear with synthetic discounts in reserved-category predictions
    for reserved_cat in ["GSCS", "GSTS", "GOBCS", "EWS"]:
        res = client.post(
            "/api/predict",
            json={
                "category": reserved_cat,
                "percentile": 90.0,
                "branch": "Computer Engineering",
            },
        )
        assert res.status_code == 200
        preds = res.json()["predictions"]
        pred_codes = {p["college_code"] for p in preds}
        assert "3199" not in pred_codes
        assert "3211" not in pred_codes

    # 2. Women-only colleges (6276 Cummins, 3035 SNDT) must not appear in General (G...) categories
    # but MUST appear in Ladies (L...) categories with their exact L... cutoffs
    res_g = client.post(
        "/api/predict",
        json={"category": "GSTS", "percentile": 90.0, "branch": "Computer Engineering"},
    )
    g_codes = {p["college_code"] for p in res_g.json()["predictions"]}
    assert "6276" not in g_codes
    assert "3035" not in g_codes

    res_l = client.post(
        "/api/predict",
        json={"category": "LSTS", "percentile": 90.0, "branch": "Computer Engineering"},
    )
    l_preds = {p["college_code"]: p for p in res_l.json()["predictions"]}
    assert "6276" in l_preds
    assert l_preds["6276"]["basis_category"] == "LSTS"
    assert l_preds["6276"]["is_estimate"] is False

    # 3. MI and TFWS must return 100% direct exact seats
    for exact_cat in ["MI", "TFWS"]:
        res_ex = client.post(
            "/api/predict",
            json={
                "category": exact_cat,
                "percentile": 92.0,
                "branch": "Computer Engineering",
            },
        )
        assert res_ex.status_code == 200
        ex_preds = res_ex.json()["predictions"]
        assert len(ex_preds) > 15
        assert all(p["basis_category"] == exact_cat and not p["is_estimate"] for p in ex_preds)

    # 4. Subsequence alignment: VJTI (3012) Computer Engineering GOPENS cutoff is > 99.94%
    # (not shifted by 2025 CAP3 Information Technology 99.81%)
    res_vjti = client.get(
        "/api/analytics/cutoffs?college_code=3012&branch=Computer+Engineering&category=GOPENS"
    )
    assert res_vjti.status_code == 200
    vjti_latest = res_vjti.json()["summary"]["latest"]
    assert vjti_latest["percentile"] > 99.94



def test_rank_scale_and_rank_percentile_consistency():
    # Percentile -> rank conversion is learned per year from real CAP rows
    res = client.get("/api/convert?percentile=90")
    assert res.status_code == 200
    conv = res.json()
    by_year = {p["year"]: p["rank"] for p in conv["per_year"]}
    assert 23000 < by_year[2023] < 26500
    assert 28000 < by_year[2024] < 31500
    assert 32000 < by_year[2025] < 36000
    assert 38000 < by_year[2026] < 48000

    latest_yr = max(by_year)
    assert latest_yr == 2026
    back = client.get(f"/api/convert?rank={by_year[latest_yr]}").json()
    assert abs(back["latest"]["percentile"] - 90) < 0.05

    # Predicting with a percentile or its equivalent rank must give the same answer
    body = {"category": "GOBCS", "branch": "Computer Engineering"}
    by_pct = client.post("/api/predict", json={**body, "percentile": 95.0}).json()
    rank95 = by_pct["student"]["rank"]
    by_rank = client.post("/api/predict", json={**body, "rank": rank95}).json()
    within_pct = {p["choice_code"] for p in by_pct["predictions"] if p["prediction_category"] == "Historically Within Range"}
    within_rank = {p["choice_code"] for p in by_rank["predictions"] if p["prediction_category"] == "Historically Within Range"}
    overlap = len(within_pct & within_rank) / max(1, len(within_pct | within_rank))
    assert overlap > 0.97

    # Exact latest-year rows report the official closing rank unchanged
    vjti = client.post(
        "/api/predict",
        json={"category": "GOPENS", "percentile": 99.99, "branch": "Computer Engineering", "round_number": 1},
    ).json()
    row = next(p for p in vjti["predictions"] if p["college_code"] == "3012")
    assert row["is_estimate"] is False
    if row["year"] == 2025:
        assert row["historical_rank"] == row["raw_rank"]
    assert len(row["history"]) >= 2
    assert row["chance_level"] in {"High", "Good", "Borderline", "Low", "Reach"}



def test_option_form_and_rank_curve():
    # 1. Rank curve + marks-to-percentile estimate
    res_curve = client.get("/api/rank-curve?marks=140")
    assert res_curve.status_code == 200
    data = res_curve.json()
    assert len(data["curve"]) >= 10
    assert data["estimate"]["mode"] == "marks"
    assert 98.0 <= data["estimate"]["estimated_percentile"] <= 99.5
    assert data["estimate"]["estimated_rank"] > 1000

    # 2. Smart CAP Option Form Generator (server-side Free cap of 10 choices)
    res_opt = client.post(
        "/api/option-form/generate",
        json={
            "percentile": 96.5,
            "category": "GOPENS",
            "branches": ["Computer Engineering", "Information Technology"],
            "cities": ["Pune", "Mumbai"],
            "strategy": "balanced",
            "max_choices": 25,
        },
    )
    assert res_opt.status_code == 200
    opt = res_opt.json()
    assert opt["is_pro"] is False
    assert opt["counts"]["total"] == 10
    assert opt["locked_choices_count"] == 15
    assert opt["total_generated"] == 25
    assert opt["health_score"] >= 50
    choices = opt["choices"]
    assert len(choices) == 10
    # Verify strict DTE preference order: cutoff rank ascending (best rank first)
    ranks = [c["historical_rank"] for c in choices if c["historical_rank"] is not None]
    assert ranks == sorted(ranks)
    assert choices[0]["preference_no"] == 1


def test_monetization_gpay_payments_leads_and_admin():
    import uuid
    from backend.api.database import SessionLocal
    from backend.api.models import PaymentOrder, CounsellingLead

    cfg = client.get("/api/monetization/config").json()
    assert cfg["gpay_number"] == "9920627188"
    assert cfg["plans"]["pro"]["amount_inr"] == 199
    assert cfg["plans"]["vip"]["amount_inr"] == 499

    unique_utr = f"TESTUTR{uuid.uuid4().hex[:8].upper()}"
    sub = client.post(
        "/api/payments/submit",
        json={
            "full_name": "Test Aspirant",
            "phone": "9876543210",
            "email": "test@example.com",
            "plan": "pro",
            "utr_number": unique_utr,
        },
    )
    assert sub.status_code == 200
    order_data = sub.json()
    key = order_data["access_key"]
    order_id = order_data["order_id"]
    assert key.startswith("CAP-PRO-")
    assert order_data["status"] == "pending"

    # Before approval, verify returns valid=False, status=pending
    v1 = client.get(f"/api/payments/verify?access_key={key}").json()
    assert v1["valid"] is False
    assert v1["status"] == "pending"

    # Admin requires valid PIN
    unauth = client.get("/api/admin/overview", headers={"X-Admin-Pin": "000000"})
    assert unauth.status_code == 401

    ov = client.get("/api/admin/overview", headers={"X-Admin-Pin": "992062"})
    assert ov.status_code == 200
    assert any(o["access_key"] == key for o in ov.json()["orders"])

    # Approve order via Admin
    app_res = client.post(
        f"/api/admin/payments/{order_id}/status",
        headers={"X-Admin-Pin": "992062"},
        json={"status": "approved"},
    )
    assert app_res.status_code == 200
    assert app_res.json()["status"] == "approved"

    # Verify now returns valid=True and plan=pro
    v2 = client.get(f"/api/payments/verify?access_key={key}").json()
    assert v2["valid"] is True
    assert v2["plan"] == "pro"

    # Submit a counselling lead
    lead_res = client.post(
        "/api/leads",
        json={
            "full_name": "Test Parent",
            "phone": "9811122233",
            "score_info": "97.2 %ile",
            "category": "GOBCS",
            "preferred_branch": "Computer Engineering",
            "message": "Need help with Pune CS colleges",
        },
    )
    assert lead_res.status_code == 200
    lead_id = lead_res.json()["id"]

    # Clean up test records so production DB stays spotless
    db = SessionLocal()
    try:
        db.query(PaymentOrder).filter(PaymentOrder.id == order_id).delete()
        db.query(CounsellingLead).filter(CounsellingLead.id == lead_id).delete()
        db.commit()
    finally:
        db.close()



def test_verified_institute_branch_catalogs():
    # 1. Sardar Patel College of Engineering (SPCE, 3014) ONLY offers Civil, Electrical, Mechanical
    spce = client.get("/api/colleges/3014").json()
    assert set(spce["branches"]) == {
        "Civil Engineering",
        "Electrical Engineering",
        "Mechanical Engineering",
    }

    # Predicting Computer Engineering must NEVER return SPCE (3014) or ICT (3036) or GCOE Karad (6005)
    ce_pred = client.post(
        "/api/predict",
        json={"category": "GOPENS", "percentile": 98.5, "branch": "Computer Engineering"},
    ).json()
    ce_codes = {p["college_code"] for p in ce_pred["predictions"]}
    assert "3014" not in ce_codes
    assert "3036" not in ce_codes
    assert "6005" not in ce_codes

    # 2. SPIT (3215) offers CSE, Computer Engineering, ENTC (no IT)
    spit = client.get("/api/colleges/3215").json()
    assert set(spit["branches"]) == {
        "Computer Science and Engineering",
        "Computer Engineering",
        "Electronics and Telecommunication Engg",
    }

    # 3. ICT Mumbai (3036) offers Chemical/Tech programs ONLY (no CS/IT/Electrical/Mechanical)
    ict = client.get("/api/colleges/3036").json()
    assert len(ict["branches"]) == 8
    assert "Chemical Engineering" in ict["branches"]
    for forbidden in ("Computer Engineering", "Information Technology", "Electrical Engineering", "Mechanical Engineering"):
        assert forbidden not in ict["branches"]

    # 4. VJTI (3012) offers Electronics Engineering (not Instrumentation)
    vjti = client.get("/api/colleges/3012").json()
    assert "Electronics Engineering" in vjti["branches"]
    assert "Instrumentation and Control Engineering" not in vjti["branches"]

    # 5. Cummins Pune (6276) offers 5 real branches (no Electrical/Mechatronics/AIML)
    cummins = client.get("/api/colleges/6276").json()
    assert set(cummins["branches"]) == {
        "Computer Engineering",
        "Information Technology",
        "Electronics and Telecommunication Engg",
        "Instrumentation and Control Engineering",
        "Mechanical Engineering",
    }

    # 6. DJ Sanghvi (3199), VESIT (3185), KJSIT (3209), PCCOE (6175), SIES (3211) have no hallucinated Electrical
    for code in ("3199", "3185", "3209", "6175", "3211"):
        c = client.get(f"/api/colleges/{code}").json()
        assert "Electrical Engineering" not in c["branches"], f"{code} wrongly listed Electrical Engineering"



def test_predict_multi_city_and_multi_branch():
    res = client.post(
        "/api/predict",
        json={
            "category": "GOPENS",
            "percentile": 98.5,
            "branches": ["Computer Engineering", "Information Technology"],
            "cities": ["Pune", "Mumbai"],
        },
    )
    assert res.status_code == 200
    data = res.json()
    preds = data["predictions"]
    assert len(preds) >= 15

    returned_branches = {p["branch"] for p in preds}
    returned_cities = {p["city"] for p in preds}
    assert returned_branches == {"Computer Engineering", "Information Technology"}
    assert returned_cities == {"Pune", "Mumbai"}
    assert "Navi Mumbai" not in returned_cities


def test_security_controls_headers_xss_auth_and_lockout():
    import uuid
    from backend.api.database import SessionLocal
    from backend.api.models import PaymentOrder, CounsellingLead
    from backend.api.security import admin_guard

    admin_guard.reset("testclient")

    # 1. OWASP security headers & strict CORS allowlist
    health_ok = client.get("/api/health", headers={"Origin": "http://localhost:3000"})
    assert health_ok.status_code == 200
    assert health_ok.headers.get("x-content-type-options") == "nosniff"
    assert health_ok.headers.get("x-frame-options") == "DENY"
    assert "max-age=" in health_ok.headers.get("strict-transport-security", "")
    assert "frame-ancestors 'none'" in health_ok.headers.get("content-security-policy", "")
    assert health_ok.headers.get("access-control-allow-origin") == "http://localhost:3000"

    health_evil = client.get("/api/health", headers={"Origin": "https://evil-attacker.example"})
    assert health_evil.headers.get("access-control-allow-origin") is None

    # 2. Anti-DoS 64KB payload ceiling
    oversized = {"category": "GOPENS", "percentile": 95.0, "branch": "A" * 70_000}
    res_big = client.post("/api/predict", json=oversized)
    assert res_big.status_code == 413

    # 3. Pagination clamping & SQL injection safety
    res_clamp = client.get("/api/colleges?limit=999999")
    assert res_clamp.status_code == 200
    assert len(res_clamp.json()["results"]) <= 200

    res_sqli = client.get("/api/colleges?search=' OR '1'='1")
    assert res_sqli.status_code == 200
    assert res_sqli.json()["total"] == 0

    # 4. Stored XSS sanitization on counselling leads
    lead_res = client.post(
        "/api/leads",
        json={
            "full_name": "<script>alert('xss')</script>Rohan <b>Patil</b>",
            "phone": "9822001122",
            "message": "<img src=x onerror=alert(1)>Need Pune CS advice",
        },
    )
    assert lead_res.status_code == 200
    xss_lead_id = lead_res.json()["id"]

    db = SessionLocal()
    try:
        stored_lead = db.query(CounsellingLead).filter(CounsellingLead.id == xss_lead_id).first()
        assert stored_lead is not None
        assert "<script>" not in stored_lead.full_name.lower()
        assert "<" not in stored_lead.full_name and ">" not in stored_lead.full_name
        assert "<img" not in (stored_lead.message or "").lower()
    finally:
        db.close()

    # 5. Admin signed Bearer token login + forged token rejection
    login_ok = client.post("/api/admin/login", json={"pin": "992062"})
    assert login_ok.status_code == 200
    admin_token = login_ok.json()["token"]
    assert admin_token.startswith("v1.")

    ov_bearer = client.get("/api/admin/overview", headers={"Authorization": f"Bearer {admin_token}"})
    assert ov_bearer.status_code == 200
    assert "no-store" in ov_bearer.headers.get("cache-control", "")

    ov_forged = client.get(
        "/api/admin/overview",
        headers={"Authorization": f"Bearer {admin_token[:-4]}XXXX"},
    )
    assert ov_forged.status_code == 401

    # 6. Duplicate UTR enumeration guard + UTR masking + signed entitlement verification & revocation
    sec_utr = f"SECUTR{uuid.uuid4().hex[:8].upper()}"
    sub_res = client.post(
        "/api/payments/submit",
        json={
            "full_name": "Priya Kulkarni",
            "phone": "9812345678",
            "plan": "pro",
            "utr_number": sec_utr,
        },
    )
    assert sub_res.status_code == 200
    sec_order_id = sub_res.json()["order_id"]
    sec_key = sub_res.json()["access_key"]
    assert len(sec_key) >= 20  # 48-bit cryptographic entropy key (CAP-PRO-XXXX-XXXX-XXXX)

    # Attacker probing same UTR with different phone gets 409 (no key leakage!)
    probe_res = client.post(
        "/api/payments/submit",
        json={
            "full_name": "Attacker",
            "phone": "9999999999",
            "plan": "pro",
            "utr_number": sec_utr,
        },
    )
    assert probe_res.status_code == 409
    assert sec_key not in probe_res.text

    # Approve via Bearer token, verify masked UTR + signed entitlement token
    client.post(
        f"/api/admin/payments/{sec_order_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "approved"},
    )
    v_ok = client.get(f"/api/payments/verify?access_key={sec_key}")
    assert v_ok.status_code == 200
    assert "no-store" in v_ok.headers.get("cache-control", "")
    v_data = v_ok.json()
    assert v_data["valid"] is True
    assert v_data["utr_number"].startswith("****")
    assert sec_utr not in v_data["utr_number"]
    assert v_data["full_name"] == "Priya"  # PII minimized to first name only
    ent_token = v_data["entitlement_token"]
    assert ent_token and ent_token.startswith("v1.")

    # Server verifies genuine token and rejects tampered token
    assert client.post("/api/payments/verify-token", json={"entitlement_token": ent_token}).json()["valid"] is True
    assert client.post("/api/payments/verify-token", json={"entitlement_token": ent_token[:-3] + "AAA"}).json()["valid"] is False

    # Revoking the order immediately invalidates even a previously valid signed token
    client.post(
        f"/api/admin/payments/{sec_order_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "rejected"},
    )
    assert client.post("/api/payments/verify-token", json={"entitlement_token": ent_token}).json()["valid"] is False

    # 7. Admin brute-force lockout after 5 wrong PINs
    admin_guard.reset("testclient")
    for _ in range(5):
        bad = client.post("/api/admin/login", json={"pin": "wrong-pin-123"})
        assert bad.status_code in (401, 429)
    locked = client.post("/api/admin/login", json={"pin": "992062"})
    assert locked.status_code == 429
    assert locked.headers.get("retry-after") is not None

    # Clean up test records & brute-force state
    admin_guard.reset("testclient")
    db = SessionLocal()
    try:
        db.query(PaymentOrder).filter(PaymentOrder.id == sec_order_id).delete()
        db.query(CounsellingLead).filter(CounsellingLead.id == xss_lead_id).delete()
        db.commit()
    finally:
        db.close()


def test_what_if_score_impact_simulator():
    res = client.post(
        "/api/what-if",
        json={
            "percentile": 94.5,
            "category": "GOPENS",
            "branches": ["Computer Engineering", "Information Technology"],
            "cities": ["Pune", "Mumbai"],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["category"] == "GOPENS"
    assert abs(data["base_percentile"] - 94.5) < 0.01
    assert data["total_courses"] >= 20
    pts = data["points"]
    assert len(pts) == 7
    # Within-range seat count must be monotonically non-decreasing as simulated score increases
    within_counts = [p["within_range"] for p in pts]
    assert within_counts == sorted(within_counts)
    base_pt = next(p for p in pts if p["delta"] == 0.0)
    assert base_pt["changed_count"] == 0
    plus2 = next(p for p in pts if p["delta"] == 2.0)
    assert plus2["within_range"] >= base_pt["within_range"]
    assert plus2["changed_count"] == plus2["within_range"] - base_pt["within_range"]

    # Rank input mode also works cleanly
    res_rank = client.post(
        "/api/what-if",
        json={"rank": 15000, "category": "GOBCS", "cities": ["Pune"]},
    )
    assert res_rank.status_code == 200
    assert res_rank.json()["base_rank"] > 0


def test_official_college_websites_and_cet_links():
    # Top premier colleges return verified direct official websites + CET Cell portal URLs
    expected = {
        "3012": "vjti.ac.in",
        "6006": "coeptech.ac.in",
        "3215": "spit.ac.in",
        "3014": "spce.ac.in",
        "6271": "pict.edu",
        "3036": "ictmumbai.edu.in",
        "6175": "pccoepune.com",
        "6273": "vit.edu",
        "6007": "walchandsangli.ac.in",
        "6276": "cumminscollege.org",
    }
    for code, expected_domain in expected.items():
        res = client.get(f"/api/colleges/{code}")
        assert res.status_code == 200
        d = res.json()
        assert d["official_website"] and expected_domain in d["official_website"]
        assert d["website_domain"] == expected_domain
        assert d["cet_portal_url"] and "mahacet.org" in d["cet_portal_url"]

    # Explorer /api/colleges and Predictor /api/predict also expose official_website
    lst = client.get("/api/colleges?search=3012").json()["results"]
    vjti_row = next(r for r in lst if r["college_code"] == "3012")
    assert vjti_row["website_domain"] == "vjti.ac.in"

    pred = client.post(
        "/api/predict",
        json={"category": "GOPENS", "percentile": 99.8, "branch": "Computer Engineering"},
    ).json()["predictions"]
    vjti_pred = next(p for p in pred if p["college_code"] == "3012")
    assert vjti_pred["official_website"] == "https://vjti.ac.in"
    assert vjti_pred["cet_portal_url"] and "03012" in vjti_pred["cet_portal_url"]


def test_verified_placements_fees_and_authentic_sources():
    # Premier college (VJTI 3012 & SPIT 3215) returns verified NIRF placements, FRA/Govt fees, ROI & authentic source URLs
    vjti = client.get("/api/colleges/3012").json()
    assert vjti["has_verified_insights"] is True
    assert vjti["placements"]["nirf_median_lpa"] >= 10.0
    assert vjti["placements"]["nirf_portal_url"] == "https://www.nirfindia.org"
    assert vjti["fees"]["annual_open_inr"] >= 80000
    assert vjti["fees"]["fra_portal_url"] == "https://mahafra.org"
    assert vjti["fees"]["mahadbt_portal_url"] == "https://mahadbt.maharashtra.gov.in"
    assert vjti["roi"]["payback_years"] < 1.0

    spit = client.get("/api/colleges/3215").json()
    assert spit["has_verified_insights"] is True
    assert "FRA" in spit["fees"]["source_label"]
    assert spit["placements"]["nirf_median_lpa"] >= 12.0

    # Predictor & Explorer also surface compact placement/fee summary
    pred = client.post(
        "/api/predict",
        json={"category": "GOPENS", "percentile": 99.8, "branch": "Computer Engineering"},
    ).json()["predictions"]
    coep_pred = next(p for p in pred if p["college_code"] == "6006")
    assert coep_pred["nirf_median_lpa"] >= 10.0
    assert coep_pred["annual_fee_inr"] >= 140000

    # Non-listed niche college never fabricates numbers — returns official verification portal links only
    niche = client.get("/api/colleges/2138").json()
    assert niche["has_verified_insights"] is False
    assert niche["placements"] is None
    assert niche["fees"] is None
    assert niche["official_sources"]["fra_portal_url"] == "https://mahafra.org"
    assert niche["official_sources"]["nirf_portal_url"] == "https://www.nirfindia.org"


def test_betterment_radar_and_roi_finder_with_pro_gating():
    import uuid
    from backend.api.database import SessionLocal
    from backend.api.models import PaymentOrder
    from backend.api.security import issue_entitlement_token

    # 1. Free call to Betterment Radar enforces server-side Top 5 preview cap
    br_free = client.post(
        "/api/betterment-radar",
        json={"percentile": 95.5, "category": "GOPENS"},
    )
    assert br_free.status_code == 200
    bf = br_free.json()
    assert bf["is_pro"] is False
    assert bf["summary"]["total_betterment_gems"] > 5
    assert len(bf["betterment_gems"]) == 5
    assert bf["summary"]["locked_betterment_count"] == bf["summary"]["total_betterment_gems"] - 5
    # Verify real R1 > R3 drop semantics
    for g in bf["betterment_gems"]:
        assert g["r1_percentile"] > g["final_percentile"]
        assert g["drop_percentile"] > 0

    # 2. Free call to Scholarship & ROI Finder calculates Girls 100% Tuition Waiver (< ₹8L)
    roi_free = client.post(
        "/api/roi-finder",
        json={
            "percentile": 97.0,
            "category": "GOBCS",
            "gender": "female",
            "income_below_8l": True,
        },
    )
    assert roi_free.status_code == 200
    rf = roi_free.json()
    assert rf["is_pro"] is False
    assert "Girls 100% Tuition Waiver" in rf["scheme_applied"]
    assert rf["summary"]["total_matches"] > 5
    assert len(rf["results"]) == 5
    assert rf["summary"]["max_four_year_savings_inr"] >= 200000
    assert rf["results"][0]["net_annual_fee_inr"] < rf["results"][0]["sticker_annual_fee_inr"]

    # 3. Create an approved Pro order & verify server-signed X-Entitlement-Token unlocks FULL data
    db = SessionLocal()
    test_key = f"CAP-PRO-{uuid.uuid4().hex[:12].upper()}"
    test_utr = f"PROTEST{uuid.uuid4().hex[:8].upper()}"
    order = PaymentOrder(
        access_key=test_key,
        full_name="Paid Pro Student",
        phone="9876543210",
        plan="pro",
        amount_inr=199,
        utr_number=test_utr,
        status="approved",
    )
    db.add(order)
    db.commit()
    order_id = order.id
    db.close()

    try:
        pro_token = issue_entitlement_token(test_key, "pro")

        br_pro = client.post(
            "/api/betterment-radar",
            json={"percentile": 95.5, "category": "GOPENS"},
            headers={"X-Entitlement-Token": pro_token},
        ).json()
        assert br_pro["is_pro"] is True
        assert br_pro["summary"]["locked_betterment_count"] == 0
        assert len(br_pro["betterment_gems"]) > 5

        roi_pro = client.post(
            "/api/roi-finder",
            json={
                "percentile": 97.0,
                "category": "GOBCS",
                "gender": "female",
                "income_below_8l": True,
                "max_annual_budget_inr": 35000,
            },
            headers={"X-Entitlement-Token": pro_token},
        ).json()
        assert roi_pro["is_pro"] is True
        assert roi_pro["summary"]["locked_count"] == 0
        assert len(roi_pro["results"]) >= 5
        assert all(r["net_annual_fee_inr"] <= 35000 for r in roi_pro["results"])
    finally:
        db = SessionLocal()
        try:
            db.query(PaymentOrder).filter(PaymentOrder.id == order_id).delete()
            db.commit()
        finally:
            db.close()


def test_2026_and_round4_cutoffs():
    # 1. Verify official 2025 Round 4 and 2026 Rounds 1-4 are loaded in SQLite
    from backend.api.database import SessionLocal
    from backend.api.models import CollegeRecord
    from sqlalchemy import func

    db = SessionLocal()
    try:
        counts = dict(
            ((yr, rn), cnt)
            for yr, rn, cnt in db.query(
                CollegeRecord.year, CollegeRecord.round_number, func.count(CollegeRecord.id)
            )
            .group_by(CollegeRecord.year, CollegeRecord.round_number)
            .all()
        )
    finally:
        db.close()

    assert counts.get((2025, 4), 0) > 10000
    for rn in (1, 2, 3, 4):
        assert counts.get((2026, rn), 0) > 10000, f"Missing 2026 CAP Round {rn}"

    # 2. Predictor supports CAP Round 4 directly and returns 2026 records
    pred_r4 = client.post(
        "/api/predict",
        json={"category": "GOPENS", "percentile": 95.0, "round_number": 4},
    )
    assert pred_r4.status_code == 200
    pr = pred_r4.json()
    assert pr["count"] > 50
    assert pr["student"]["rank_scale_year"] == 2026
    assert all(p["round"] == 4 for p in pr["predictions"])
    assert any(p["year"] == 2026 for p in pr["predictions"])

    # 3. Compare endpoint supports 2026 CAP Round 4
    cmp_res = client.post(
        "/api/compare",
        json={
            "college_codes": ["3012", "6006", "6271"],
            "category": "GOPENS",
            "year": 2026,
            "round_number": 4,
        },
    )
    assert cmp_res.status_code == 200
    assert len(cmp_res.json()["comparison"]) > 10

    # 4. Betterment Radar exposes Round 4 progression fields
    br = client.post(
        "/api/betterment-radar",
        json={"percentile": 96.0, "category": "GOPENS"},
    )
    assert br.status_code == 200
    gems = br.json()["betterment_gems"]
    assert len(gems) >= 5
    assert "r4_percentile" in gems[0] and "final_round" in gems[0]


def test_google_login_portal_and_cloud_sync():
    import uuid
    from backend.api.database import SessionLocal
    from backend.api.models import UserAccount, PaymentOrder
    from backend.api.security import issue_user_token

    # 1. Config endpoint is public & returns boolean google_enabled
    cfg = client.get("/api/auth/config")
    assert cfg.status_code == 200
    assert "google_enabled" in cfg.json()

    # 2. Forged/bogus Google credential is rejected (401 when configured, 503 when unconfigured)
    bad_g = client.post("/api/auth/google", json={"credential": "x" * 60})
    assert bad_g.status_code in (401, 503)

    # 3. Unauthenticated /api/auth/me and /api/auth/sync fail with 401
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/sync", json={"saved_category": "GOPENS"}).status_code == 401

    # 4. Create test Google user + approved Pro order with matching email -> verify token, auto-restore & cloud sync
    db = SessionLocal()
    test_email = f"student_{uuid.uuid4().hex[:8]}@gmail.com"
    test_sub = f"sub_{uuid.uuid4().hex[:12]}"
    test_key = f"CAP-PRO-{uuid.uuid4().hex[:12].upper()}"
    test_utr = f"GAUTH{uuid.uuid4().hex[:8].upper()}"

    user = UserAccount(
        google_sub=test_sub,
        email=test_email,
        full_name="Aarav Deshmukh",
        avatar_url="https://lh3.googleusercontent.com/a/default-user",
    )
    order = PaymentOrder(
        access_key=test_key,
        full_name="Aarav Deshmukh",
        phone="9876543210",
        email=test_email,
        plan="pro",
        amount_inr=199,
        utr_number=test_utr,
        status="approved",
    )
    db.add(user)
    db.add(order)
    db.commit()
    db.refresh(user)
    user_id = user.id
    order_id = order.id
    db.close()

    try:
        tok = issue_user_token(user_id, test_email)
        assert tok.startswith("v1.")

        # /api/auth/me returns profile + automatically restores linked Pro entitlement!
        me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {tok}"})
        assert me.status_code == 200
        assert "no-store" in me.headers.get("cache-control", "")
        md = me.json()
        assert md["user"]["email"] == test_email
        assert md["entitlement"] is not None
        assert md["entitlement"]["plan"] == "pro"
        assert md["entitlement"]["entitlement_token"].startswith("v1.")

        # Tampered user token is rejected
        bad_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {tok[:-4]}ZZZZ"})
        assert bad_me.status_code == 401

        # /api/auth/sync persists score, category & sanitized bookmarks
        sync = client.post(
            "/api/auth/sync",
            headers={"Authorization": f"Bearer {tok}"},
            json={
                "saved_input_type": "percentile",
                "saved_score": 98.45,
                "saved_category": "GOBCS",
                "bookmarks": [
                    {
                        "key": "3012|Computer Engineering",
                        "college_code": "3012",
                        "college_name": "<b>VJTI</b> Mumbai",
                        "city": "Mumbai",
                        "branch": "Computer Engineering",
                        "historical_percentile": 99.99,
                    }
                ],
            },
        )
        assert sync.status_code == 200
        su = sync.json()["user"]
        assert su["saved_score"] == 98.45
        assert su["saved_category"] == "GOBCS"
        assert len(su["bookmarks"]) == 1
        assert "<b>" not in su["bookmarks"][0]["college_name"]
    finally:
        db = SessionLocal()
        try:
            db.query(UserAccount).filter(UserAccount.id == user_id).delete()
            db.query(PaymentOrder).filter(PaymentOrder.id == order_id).delete()
            db.commit()
        finally:
            db.close()


def test_interactive_college_map_api():
    # 1. All 400 Maharashtra colleges returned with valid lat/lng bounds & Google Maps directions URL
    res = client.get("/api/map/colleges")
    assert res.status_code == 200
    d = res.json()
    assert d["score_mode"] is False
    assert d["summary"]["total"] >= 390
    assert d["summary"]["exact_campus_count"] >= 70
    vjti = next(c for c in d["colleges"] if c["college_code"] == "3012")
    assert vjti["is_exact_campus"] is True
    assert 18.9 < vjti["lat"] < 19.2 and 72.7 < vjti["lng"] < 73.0
    assert "google.com/maps" in vjti["google_maps_url"]
    # All pins stay strictly inside Maharashtra geographic bounding box
    for c in d["colleges"]:
        assert 15.5 <= c["lat"] <= 22.5, f"Out-of-bounds lat for {c['college_code']}"
        assert 72.4 <= c["lng"] <= 81.0, f"Out-of-bounds lng for {c['college_code']}"

    # 2. Score Match Map mode returns live prediction bands per college
    sm = client.get("/api/map/colleges?percentile=97.0&category=GOPENS&city=Pune")
    assert sm.status_code == 200
    sd = sm.json()
    assert sd["score_mode"] is True
    assert sd["summary"]["total"] >= 15
    assert all(c["city"] == "Pune" for c in sd["colleges"])
    assert all(
        c["prediction_category"] in ("Historically Within Range", "Moderate", "Ambitious")
        for c in sd["colleges"]
    )

    # 3. Single college detail endpoint also includes verified campus location payload
    coep = client.get("/api/colleges/6006").json()
    assert coep["location"]["is_exact_campus"] is True
    assert 18.4 < coep["location"]["lat"] < 18.7


def test_razorpay_instant_payment_and_auto_unlock(monkeypatch):
    import hashlib
    import hmac
    import uuid
    from backend.api.database import SessionLocal
    from backend.api.models import PaymentOrder

    test_key_id = "rzp_test_CapCompass1234"
    test_secret = "super_secret_razorpay_test_key_99999"
    monkeypatch.setenv("RAZORPAY_KEY_ID", test_key_id)
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", test_secret)

    # 1. Config endpoint advertises razorpay_enabled=True with public key_id only (never secret!)
    cfg = client.get("/api/monetization/config").json()
    assert cfg["razorpay_enabled"] is True
    assert cfg["razorpay_key_id"] == test_key_id
    assert test_secret not in str(cfg)

    # 2. Seed a pending Razorpay order (simulating create-order result)
    rzp_order_id = f"order_{uuid.uuid4().hex[:14]}"
    rzp_payment_id = f"pay_{uuid.uuid4().hex[:14]}"
    access_key = f"CAP-PRO-{uuid.uuid4().hex[:12].upper()}"

    db = SessionLocal()
    order = PaymentOrder(
        access_key=access_key,
        full_name="Instant Student",
        phone="9876543210",
        email="instant_student@gmail.com",
        plan="pro",
        amount_inr=199,
        utr_number=rzp_order_id,
        payment_method="Razorpay Instant (UPI/GPay/Card)",
        status="pending",
        notes=f"rzp_order:{rzp_order_id}",
    )
    db.add(order)
    db.commit()
    order_id = order.id
    db.close()

    try:
        # 3. Forged Razorpay signature MUST be rejected with 400 and order stays pending
        bad = client.post(
            "/api/payments/razorpay/verify",
            json={
                "razorpay_order_id": rzp_order_id,
                "razorpay_payment_id": rzp_payment_id,
                "razorpay_signature": "0" * 64,
            },
        )
        assert bad.status_code == 400

        # 4. Valid HMAC-SHA256 signature INSTANTLY approves order & issues signed Pro entitlement token
        valid_sig = hmac.new(
            test_secret.encode("utf-8"),
            f"{rzp_order_id}|{rzp_payment_id}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        ok = client.post(
            "/api/payments/razorpay/verify",
            json={
                "razorpay_order_id": rzp_order_id,
                "razorpay_payment_id": rzp_payment_id,
                "razorpay_signature": valid_sig,
            },
        )
        assert ok.status_code == 200
        vd = ok.json()
        assert vd["verified"] is True
        assert vd["status"] == "approved"
        assert vd["plan"] == "pro"
        ent_token = vd["entitlement_token"]
        assert ent_token.startswith("v1.")

        # 5. Server-enforced Pro feature unlocks IMMEDIATELY with the returned token
        br = client.post(
            "/api/betterment-radar",
            json={"percentile": 95.5, "category": "GOPENS"},
            headers={"X-Entitlement-Token": ent_token},
        ).json()
        assert br["is_pro"] is True
        assert br["summary"]["locked_betterment_count"] == 0
    finally:
        db = SessionLocal()
        try:
            db.query(PaymentOrder).filter(PaymentOrder.id == order_id).delete()
            db.commit()
        finally:
            db.close()


def test_persistent_database_layer_and_saved_option_forms():
    import uuid
    from backend.api.database import AppSessionLocal, normalize_database_url
    from backend.api.models import SavedOptionForm, UserAccount
    from backend.api.security import issue_user_token

    # 1. URL normalizer properly prepares Neon/Supabase/Render Postgres URLs with SSL
    norm = normalize_database_url("postgres://u:p@ep-cool-123.neon.tech/neondb")
    assert norm.startswith("postgresql+psycopg2://")
    assert "sslmode=require" in norm

    # 2. /api/health reports database persistence diagnostics without leaking secrets
    h = client.get("/api/health").json()
    assert h["status"] == "ok"
    assert "database" in h
    assert h["database"]["engine"] in ("postgresql", "sqlite", "sqlite_custom")

    # 3. Signed-in student can save & reload Option Forms in AppDataBase
    db = AppSessionLocal()
    email = f"optform_{uuid.uuid4().hex[:8]}@gmail.com"
    u = UserAccount(
        google_sub=f"sub_{uuid.uuid4().hex[:12]}",
        email=email,
        full_name="Meera Joshi",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    uid = u.id
    db.close()

    try:
        tok = issue_user_token(uid, email)
        save_res = client.post(
            "/api/option-form/save",
            headers={"Authorization": f"Bearer {tok}"},
            json={
                "title": "My Pune CS Form",
                "category": "GOPENS",
                "score_label": "99.10 %ile",
                "choices": [
                    {
                        "preference_no": 1,
                        "college_code": "6006",
                        "choice_code": "600624210",
                        "college_name": "COEP Technological University",
                        "city": "Pune",
                        "branch": "Computer Science and Engineering",
                        "band": "Dream",
                        "historical_percentile": 99.98,
                        "historical_rank": 150,
                    }
                ],
            },
        )
        assert save_res.status_code == 200
        assert save_res.json()["saved"] is True
        assert save_res.json()["count"] == 1

        got = client.get(
            "/api/option-form/saved",
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert got.status_code == 200
        gd = got.json()
        assert gd["found"] is True
        assert gd["form"]["title"] == "My Pune CS Form"
        assert gd["form"]["choices"][0]["college_code"] == "6006"

        # 4. Admin overview includes database status & registered Google users list
        ov = client.get("/api/admin/overview", headers={"X-Admin-Pin": "992062"}).json()
        assert "database" in ov
        assert any(row["email"] == email for row in ov["users"])
    finally:
        db = AppSessionLocal()
        try:
            db.query(SavedOptionForm).filter(SavedOptionForm.user_id == uid).delete()
            db.query(UserAccount).filter(UserAccount.id == uid).delete()
            db.commit()
        finally:
            db.close()


def test_security_audit_rbac_revocation_pbkdf2_and_audit_logs(monkeypatch):
    import uuid
    from backend.api.database import AppSessionLocal
    from backend.api.models import (
        PaymentOrder,
        RevokedToken,
        SecurityAuditLog,
        UserAccount,
    )
    from backend.api.security import (
        SecurityMiddleware,
        admin_guard,
        hash_secret,
        is_admin_pin_configured,
        issue_entitlement_token,
        issue_user_token,
        sanitize_dte_code,
        sanitize_google_avatar_url,
        verify_admin_secret,
        verify_hashed_secret,
    )

    admin_guard.reset("testclient")

    # 0. Verify sliding-window rate-limiter blocks burst abuse on /api/admin/login & /api/payments/verify
    monkeypatch.delenv("CAP_DISABLE_RATE_LIMIT", raising=False)
    rl_mw = SecurityMiddleware(app)
    for _ in range(8):
        ok_rl, _, _ = rl_mw._check_rate_limit("203.0.113.10", "/api/admin/login", "POST")
        assert ok_rl is True
    ok_rl_9, _, retry_9 = rl_mw._check_rate_limit("203.0.113.10", "/api/admin/login", "POST")
    assert ok_rl_9 is False and retry_9 > 0

    for _ in range(10):
        ok_v, _, _ = rl_mw._check_rate_limit("203.0.113.11", "/api/payments/verify", "GET")
        assert ok_v is True
    ok_v_11, _, retry_v11 = rl_mw._check_rate_limit("203.0.113.11", "/api/payments/verify", "GET")
    assert ok_v_11 is False and retry_v11 > 0

    # Isolate remaining RBAC/revocation assertions from earlier tests' IP rate buckets
    monkeypatch.setenv("CAP_DISABLE_RATE_LIMIT", "1")

    # 1. PBKDF2-HMAC-SHA256 salted password/PIN hashing verification
    strong_pin = "CapCompass#Audit2026!"
    pin_hash = hash_secret(strong_pin)
    assert pin_hash.startswith("pbkdf2:sha256:310000$")
    assert verify_hashed_secret(strong_pin, pin_hash) is True
    assert verify_hashed_secret("wrong-pin", pin_hash) is False
    assert verify_hashed_secret("992062", pin_hash) is False

    # 2. Production fail-closed: public default PIN "992062" MUST be rejected in production
    monkeypatch.setenv("CAP_ENV", "production")
    monkeypatch.delenv("CAP_ADMIN_PIN_HASH", raising=False)
    monkeypatch.delenv("CAP_ADMIN_PIN", raising=False)
    assert is_admin_pin_configured() is False
    assert verify_admin_secret("992062") is False

    locked_login = client.post("/api/admin/login", json={"pin": "992062"})
    assert locked_login.status_code == 503
    # Legacy X-Admin-Pin header MUST be rejected in production
    legacy_prod = client.get("/api/admin/overview", headers={"X-Admin-Pin": "992062"})
    assert legacy_prod.status_code == 401
    admin_guard.reset("testclient")

    # Configure PBKDF2 hash in production -> /api/admin/login succeeds, X-Admin-Pin STILL blocked!
    monkeypatch.setenv("CAP_ADMIN_PIN_HASH", pin_hash)
    assert is_admin_pin_configured() is True
    assert verify_admin_secret(strong_pin) is True

    legacy_still_blocked = client.get(
        "/api/admin/overview", headers={"X-Admin-Pin": strong_pin}
    )
    assert legacy_still_blocked.status_code == 401
    admin_guard.reset("testclient")

    prod_login = client.post("/api/admin/login", json={"pin": strong_pin})
    assert prod_login.status_code == 200
    admin_tok = prod_login.json()["token"]
    assert prod_login.json()["expires_in"] == 3600
    assert prod_login.json()["role"] == "super_admin"

    assert (
        client.get(
            "/api/admin/overview", headers={"Authorization": f"Bearer {admin_tok}"}
        ).status_code
        == 200
    )

    # 3. Server-side admin token revocation (/api/admin/logout) defeats stolen token replay
    out_admin = client.post(
        "/api/admin/logout", headers={"Authorization": f"Bearer {admin_tok}"}
    )
    assert out_admin.status_code == 200
    replay_admin = client.get(
        "/api/admin/overview", headers={"Authorization": f"Bearer {admin_tok}"}
    )
    assert replay_admin.status_code == 401
    admin_guard.reset("testclient")

    # 4. Strict server-side RBAC (student -> 403, admin -> overview 200 / role-change 403, super_admin -> 200)
    db = AppSessionLocal()
    tag = uuid.uuid4().hex[:8]
    student_u = UserAccount(
        google_sub=f"sub_stu_{tag}",
        email=f"stu_{tag}@gmail.com",
        full_name="Student User",
        role="student",
        is_active=True,
        token_version=1,
    )
    admin_u = UserAccount(
        google_sub=f"sub_adm_{tag}",
        email=f"adm_{tag}@gmail.com",
        full_name="Staff Admin",
        role="admin",
        is_active=True,
        token_version=1,
    )
    super_u = UserAccount(
        google_sub=f"sub_sup_{tag}",
        email=f"sup_{tag}@gmail.com",
        full_name="Super Owner",
        role="super_admin",
        is_active=True,
        token_version=1,
    )
    pro_key = f"CAP-PRO-{uuid.uuid4().hex[:12].upper()}"
    pro_order = PaymentOrder(
        access_key=pro_key,
        full_name="Pro Tester",
        phone="9876543210",
        plan="pro",
        amount_inr=199,
        utr_number=f"SECPRO{tag.upper()}",
        status="approved",
    )
    db.add_all([student_u, admin_u, super_u, pro_order])
    db.commit()
    for obj in (student_u, admin_u, super_u, pro_order):
        db.refresh(obj)
    stu_id, adm_id, sup_id, ord_id = student_u.id, admin_u.id, super_u.id, pro_order.id
    stu_email, adm_email, sup_email = student_u.email, admin_u.email, super_u.email
    db.close()

    try:
        stu_tok = issue_user_token(stu_id, stu_email, role="student", token_version=1)
        adm_tok = issue_user_token(adm_id, adm_email, role="admin", token_version=1)
        sup_tok = issue_user_token(sup_id, sup_email, role="super_admin", token_version=1)

        # Student attempting to access admin endpoint -> 403 Forbidden (privilege escalation blocked)
        esc = client.get(
            "/api/admin/overview", headers={"Authorization": f"Bearer {stu_tok}"}
        )
        assert esc.status_code == 403

        # Regular admin can read overview (200) but CANNOT alter roles (403 Super-Admin only)
        assert (
            client.get(
                "/api/admin/overview", headers={"Authorization": f"Bearer {adm_tok}"}
            ).status_code
            == 200
        )
        adm_role_try = client.post(
            f"/api/admin/users/{stu_id}/role",
            headers={"Authorization": f"Bearer {adm_tok}"},
            json={"role": "admin"},
        )
        assert adm_role_try.status_code == 403

        # Super-admin updates student -> counsellor; token_version increments -> old student token invalidated!
        promote = client.post(
            f"/api/admin/users/{stu_id}/role",
            headers={"Authorization": f"Bearer {sup_tok}"},
            json={"role": "counsellor", "is_active": True},
        )
        assert promote.status_code == 200
        assert promote.json()["role"] == "counsellor"
        assert promote.json()["token_version"] == 2

        # Old student token (tv=1) is IMMEDIATELY rejected on /api/auth/me
        stale_stu = client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {stu_tok}"}
        )
        assert stale_stu.status_code == 401

        # Super-admin suspends user -> fresh token gets 403 Forbidden
        suspend = client.post(
            f"/api/admin/users/{stu_id}/role",
            headers={"Authorization": f"Bearer {sup_tok}"},
            json={"role": "student", "is_active": False},
        )
        assert suspend.status_code == 200
        stu_tok_v3 = issue_user_token(stu_id, stu_email, role="student", token_version=3)
        assert (
            client.get(
                "/api/auth/me", headers={"Authorization": f"Bearer {stu_tok_v3}"}
            ).status_code
            == 403
        )

        # User logout (/api/auth/logout) revokes JTI & bumps token_version immediately
        assert (
            client.post(
                "/api/auth/logout", headers={"Authorization": f"Bearer {adm_tok}"}
            ).status_code
            == 200
        )
        assert (
            client.get(
                "/api/auth/me", headers={"Authorization": f"Bearer {adm_tok}"}
            ).status_code
            == 401
        )

        # 5. Server-side Option Form Pro paywall enforcement + Export audit log
        pro_ent = issue_entitlement_token(pro_key, "pro")
        opt_pro = client.post(
            "/api/option-form/generate",
            headers={"X-Entitlement-Token": pro_ent},
            json={
                "percentile": 96.5,
                "category": "GOPENS",
                "branches": ["Computer Engineering", "Information Technology"],
                "cities": ["Pune", "Mumbai"],
                "strategy": "balanced",
                "max_choices": 25,
            },
        )
        assert opt_pro.status_code == 200
        assert opt_pro.json()["is_pro"] is True
        assert opt_pro.json()["locked_choices_count"] == 0
        assert len(opt_pro.json()["choices"]) == 25

        exp_res = client.post(
            "/api/audit/export",
            headers={"Authorization": f"Bearer {sup_tok}"},
            json={"export_type": "option_form", "format": "csv", "record_count": 25},
        )
        assert exp_res.status_code == 200
        assert exp_res.json()["recorded"] is True

        # 6. Strict URL allowlist & DTE code sanitization
        assert sanitize_google_avatar_url("https://evil.example/tracker.png") is None
        assert sanitize_google_avatar_url("javascript:alert(1)") is None
        assert (
            sanitize_google_avatar_url("https://lh3.googleusercontent.com/a/test")
            == "https://lh3.googleusercontent.com/a/test"
        )
        assert sanitize_dte_code("6006<script>") == "6006"
        assert sanitize_dte_code("not-a-code") == ""

        # 7. Verify Security Audit Logs captured all security events & leaked ZERO secrets
        logs_res = client.get(
            "/api/admin/audit-logs?limit=100",
            headers={"Authorization": f"Bearer {sup_tok}"},
        )
        assert logs_res.status_code == 200
        logs_data = logs_res.json()
        ev_types = {row["event_type"] for row in logs_data["logs"]}
        assert "rbac_privilege_escalation_blocked" in ev_types
        assert "rbac_role_changed" in ev_types
        assert "admin_logout" in ev_types
        assert "user_logout" in ev_types
        assert "data_exported" in ev_types
        # Confirm ZERO plaintext secrets or tokens ever appear in persisted audit logs
        raw_dump = str(logs_data)
        assert strong_pin not in raw_dump
        assert admin_tok not in raw_dump
        assert sup_tok not in raw_dump
    finally:
        admin_guard.reset("testclient")
        db = AppSessionLocal()
        try:
            db.query(UserAccount).filter(
                UserAccount.id.in_([stu_id, adm_id, sup_id])
            ).delete(synchronize_session=False)
            db.query(PaymentOrder).filter(PaymentOrder.id == ord_id).delete()
            db.query(RevokedToken).delete()
            db.query(SecurityAuditLog).filter(
                SecurityAuditLog.actor_identity.in_(
                    [stu_email, adm_email, sup_email, "admin_pin"]
                )
            ).delete(synchronize_session=False)
            db.query(SecurityAuditLog).filter(
                SecurityAuditLog.event_type.in_(
                    [
                        "admin_login_misconfigured",
                        "admin_auth_failed",
                        "revoked_admin_token_rejected",
                    ]
                )
            ).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()


def test_pro_option_form_auditor_and_quota_optimizer_gating(monkeypatch):
    import uuid
    from backend.api.database import AppSessionLocal
    from backend.api.models import PaymentOrder
    from backend.api.security import issue_entitlement_token

    monkeypatch.setenv("CAP_DISABLE_RATE_LIMIT", "1")

    # 1. Option Form Generator exposes anonymized locked_teasers on Free without leaking college_name/choice_code
    gen_free = client.post(
        "/api/option-form/generate",
        json={
            "percentile": 96.5,
            "category": "GOPENS",
            "branches": ["Computer Engineering", "Information Technology"],
            "cities": ["Pune", "Mumbai"],
            "max_choices": 25,
        },
    ).json()
    assert gen_free["is_pro"] is False
    assert len(gen_free["locked_teasers"]) == 3
    for teaser in gen_free["locked_teasers"]:
        assert "college_name" not in teaser
        assert "choice_code" not in teaser
        assert "city" in teaser and "branch" in teaser

    # 2. Option Form Mistake Auditor (Free): detects ordering blunder + missing TFWS, hides full auto-fix
    intentionally_flawed_choices = [
        {"college_code": "6175", "branch": "Information Technology"},  # PCCOE IT placed ABOVE COEP/PICT!
        {"college_code": "6006", "branch": "Computer Science and Engineering"},
        {"college_code": "6271", "branch": "Computer Engineering"},
    ]
    aud_free = client.post(
        "/api/option-form/audit",
        json={
            "percentile": 98.5,
            "category": "GOPENS",
            "income_below_8l": True,
            "choices": intentionally_flawed_choices,
        },
    )
    assert aud_free.status_code == 200
    af = aud_free.json()
    assert af["is_pro"] is False
    assert af["summary"]["ordering_blunders"] >= 1
    assert af["summary"]["missing_tfws_codes"] >= 1
    assert len(af["issues"]) == 1
    assert af["optimized_choices"] == []
    assert af["tfws_injections"] == []

    # 3. Multi-Quota & TFWS Seat Unlocker (Free): returns Top 3 + anonymized teasers
    qo_free = client.post(
        "/api/quota-optimizer",
        json={
            "percentile": 95.5,
            "base_category": "GOBCS",
            "gender": "female",
            "home_university": "SPPU",
            "income_below_8l": True,
            "branches": ["Computer Engineering", "Information Technology"],
            "cities": ["Pune", "Mumbai"],
        },
    )
    assert qo_free.status_code == 200
    qf = qo_free.json()
    assert qf["is_pro"] is False
    assert qf["summary"]["total_opportunities"] > 3
    assert len(qf["results"]) == 3
    assert qf["summary"]["locked_count"] == qf["summary"]["total_opportunities"] - 3
    assert len(qf["locked_teasers"]) >= 1
    for lt in qf["locked_teasers"]:
        assert "college_name" not in lt and "choice_code" not in lt

    # 4. Seed approved Pro PaymentOrder & verify full server unlock for both endpoints
    db = AppSessionLocal()
    pro_key = f"CAP-PRO-{uuid.uuid4().hex[:12].upper()}"
    order = PaymentOrder(
        access_key=pro_key,
        full_name="Pro Audit Student",
        phone="9876543210",
        plan="pro",
        amount_inr=199,
        utr_number=f"AUDPRO{uuid.uuid4().hex[:8].upper()}",
        status="approved",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    ord_id = order.id
    db.close()

    try:
        pro_tok = issue_entitlement_token(pro_key, "pro")

        aud_pro = client.post(
            "/api/option-form/audit",
            headers={"X-Entitlement-Token": pro_tok},
            json={
                "percentile": 98.5,
                "category": "GOPENS",
                "income_below_8l": True,
                "choices": intentionally_flawed_choices,
            },
        ).json()
        assert aud_pro["is_pro"] is True
        assert aud_pro["summary"]["locked_issues_count"] == 0
        assert len(aud_pro["tfws_injections"]) >= 1
        assert len(aud_pro["optimized_choices"]) > len(intentionally_flawed_choices)
        assert any(c.get("basis_category") == "TFWS" for c in aud_pro["optimized_choices"])

        qo_pro = client.post(
            "/api/quota-optimizer",
            headers={"X-Entitlement-Token": pro_tok},
            json={
                "percentile": 95.5,
                "base_category": "GOBCS",
                "gender": "female",
                "home_university": "SPPU",
                "income_below_8l": True,
                "branches": ["Computer Engineering", "Information Technology"],
                "cities": ["Pune", "Mumbai"],
            },
        ).json()
        assert qo_pro["is_pro"] is True
        assert qo_pro["summary"]["locked_count"] == 0
        assert qo_pro["locked_teasers"] == []
        assert len(qo_pro["results"]) > 3

        # Compare endpoint also returns NIRF median salary & FRA annual fee enrichment
        cmp_res = client.post(
            "/api/compare",
            json={"college_codes": ["3012", "6006"], "category": "GOPENS", "year": 2026, "round_number": 1},
        ).json()["comparison"]
        vjti_cmp = next(r for r in cmp_res if r["college_code"] == "3012")
        assert vjti_cmp["nirf_median_lpa"] >= 10.0
        assert vjti_cmp["annual_fee_inr"] >= 80000
    finally:
        db = AppSessionLocal()
        try:
            db.query(PaymentOrder).filter(PaymentOrder.id == ord_id).delete()
            db.commit()
        finally:
            db.close()
