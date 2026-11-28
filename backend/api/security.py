import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
import urllib.parse
from collections import defaultdict, deque
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

ROOT = Path(__file__).resolve().parents[2]


def _load_dotenv_if_present() -> None:
    """Load simple KEY=VALUE pairs from root .env without overwriting real env vars."""
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    try:
        for line in env_path.read_text(encoding="utf-8").splitlines():
            s = line.strip()
            if not s or s.startswith("#") or "=" not in s:
                continue
            k, v = s.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v
    except Exception:
        pass


_load_dotenv_if_present()


def _get_or_create_signing_secret() -> bytes:
    env_secret = os.environ.get("CAP_SIGNING_SECRET", "").strip()
    if len(env_secret) >= 32:
        return env_secret.encode("utf-8")
    key_file = ROOT / ".cap_secret.key"
    try:
        if key_file.exists():
            raw = key_file.read_text(encoding="utf-8").strip()
            if len(raw) >= 32:
                return raw.encode("utf-8")
        generated = secrets.token_hex(32)
        key_file.write_text(generated, encoding="utf-8")
        try:
            os.chmod(key_file, 0o600)
        except Exception:
            pass
        return generated.encode("utf-8")
    except Exception:
        return secrets.token_bytes(32)


SIGNING_SECRET = _get_or_create_signing_secret()
IS_PRODUCTION = (
    os.environ.get("CAP_ENV", "development").strip().lower() == "production"
    or os.environ.get("RENDER", "").strip().lower() == "true"
)
TRUST_PROXY = (
    os.environ.get("CAP_TRUST_PROXY", "0").strip() == "1"
    or os.environ.get("RENDER", "").strip().lower() == "true"
)

# Strict CORS allowlist (never "*" in production!)
_raw_origins = os.environ.get(
    "CAP_ALLOWED_ORIGINS",
    "https://cap-campus.vercel.app,https://cap-campus-yacb.vercel.app,http://localhost:3000,http://127.0.0.1:3000",
)
ALLOWED_ORIGINS: List[str] = [
    o.strip().rstrip("/") for o in _raw_origins.split(",") if o.strip()
]
ALLOWED_ORIGIN_REGEX = r"^https://cap-campus(?:-[a-z0-9-]+)?\.vercel\.app$"


def get_google_client_id() -> str:
    return os.environ.get("GOOGLE_CLIENT_ID", "").strip()


def get_razorpay_credentials() -> Tuple[str, str]:
    key_id = os.environ.get("RAZORPAY_KEY_ID", "").strip()
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()
    return key_id, key_secret


def get_razorpay_webhook_secret() -> str:
    return os.environ.get("RAZORPAY_WEBHOOK_SECRET", "").strip()


def verify_razorpay_signature(order_id: str, payment_id: str, signature: str) -> bool:
    _, secret = get_razorpay_credentials()
    if not secret or not order_id or not payment_id or not signature:
        return False
    msg = f"{order_id.strip()}|{payment_id.strip()}".encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.strip().lower())


def verify_razorpay_webhook_signature(raw_body: bytes, signature: str) -> bool:
    secret = get_razorpay_webhook_secret()
    if not secret or not raw_body or not signature:
        return False
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.strip().lower())


# -----------------------------------------------------------------------------
# PASSWORD / PIN HASHING (PBKDF2-HMAC-SHA256 — OWASP 2026 Compliant)
# -----------------------------------------------------------------------------
PBKDF2_ITERATIONS = 310_000
_LEGACY_DEV_PIN = "992062"


def hash_secret(plaintext: str, iterations: int = PBKDF2_ITERATIONS) -> str:
    """Derive a salted PBKDF2-HMAC-SHA256 password/PIN hash (never store plaintext)."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        plaintext.strip().encode("utf-8"),
        salt.encode("ascii"),
        iterations,
    )
    return f"pbkdf2:sha256:{iterations}${salt}${dk.hex()}"


def verify_hashed_secret(candidate: str, stored_hash: str) -> bool:
    """Constant-time verification of a PBKDF2-HMAC-SHA256 hash string."""
    if not candidate or not stored_hash:
        return False
    try:
        header, salt, digest_hex = stored_hash.strip().split("$", 2)
        parts = header.split(":")
        if len(parts) != 3 or parts[0] != "pbkdf2" or parts[1] != "sha256":
            return False
        iters = int(parts[2])
        if iters < 100_000 or iters > 2_000_000:
            return False
        dk = hashlib.pbkdf2_hmac(
            "sha256",
            candidate.strip().encode("utf-8"),
            salt.encode("ascii"),
            iters,
        )
        return hmac.compare_digest(dk.hex(), digest_hex.strip().lower())
    except Exception:
        return False


def is_production_runtime() -> bool:
    return (
        os.environ.get("CAP_ENV", "development").strip().lower() == "production"
        or os.environ.get("RENDER", "").strip().lower() == "true"
    )


def get_superadmin_emails() -> Set[str]:
    raw = os.environ.get("CAP_SUPERADMIN_EMAILS", "").strip()
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def is_admin_pin_configured() -> bool:
    """
    In production, fail closed unless CAP_ADMIN_PIN_HASH or a non-default
    CAP_ADMIN_PIN (>= 8 chars) is explicitly configured in environment variables.
    """
    if os.environ.get("CAP_ADMIN_PIN_HASH", "").strip():
        return True
    env_pin = os.environ.get("CAP_ADMIN_PIN", "").strip()
    if is_production_runtime():
        return len(env_pin) >= 8 and env_pin != _LEGACY_DEV_PIN
    return True


def verify_admin_secret(candidate: Optional[str]) -> bool:
    if not candidate or not isinstance(candidate, str):
        return False
    cand = candidate.strip()
    if not cand:
        return False

    # 1. Preferred: Salted PBKDF2 hash stored in CAP_ADMIN_PIN_HASH
    stored_hash = os.environ.get("CAP_ADMIN_PIN_HASH", "").strip()
    if stored_hash:
        return verify_hashed_secret(cand, stored_hash)

    # 2. Environment-configured PIN (production forbids weak public-repo default)
    env_pin = os.environ.get("CAP_ADMIN_PIN", "").strip()
    if is_production_runtime():
        if len(env_pin) < 8 or env_pin == _LEGACY_DEV_PIN:
            return False
        expected = env_pin
    else:
        expected = env_pin or _LEGACY_DEV_PIN

    # Hash both to equal length before constant-time comparison
    h_cand = hashlib.sha256(cand.encode("utf-8")).digest()
    h_exp = hashlib.sha256(expected.encode("utf-8")).digest()
    return hmac.compare_digest(h_cand, h_exp)


# -----------------------------------------------------------------------------
# SIGNED SESSION & ENTITLEMENT TOKENS (HMAC-SHA256 with JTI & Token Version)
# -----------------------------------------------------------------------------
def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def sign_token(payload: dict, ttl_seconds: int) -> str:
    now = int(time.time())
    body = {
        **payload,
        "jti": payload.get("jti") or secrets.token_hex(12),
        "exp": now + ttl_seconds,
        "iat": now,
    }
    raw = json.dumps(body, separators=(",", ":"), sort_keys=True).encode("utf-8")
    b64_payload = _b64url_encode(raw)
    sig = hmac.new(SIGNING_SECRET, b64_payload.encode("ascii"), hashlib.sha256).digest()
    return f"v1.{b64_payload}.{_b64url_encode(sig)}"


def verify_signed_token(token: str, expected_scope: str) -> Optional[dict]:
    if not token or not isinstance(token, str):
        return None
    parts = token.strip().split(".")
    if len(parts) != 3 or parts[0] != "v1":
        return None
    _, b64_payload, b64_sig = parts
    expected_sig = hmac.new(
        SIGNING_SECRET, b64_payload.encode("ascii"), hashlib.sha256
    ).digest()
    try:
        given_sig = _b64url_decode(b64_sig)
    except Exception:
        return None
    if not hmac.compare_digest(expected_sig, given_sig):
        return None
    try:
        payload = json.loads(_b64url_decode(b64_payload).decode("utf-8"))
    except Exception:
        return None
    if payload.get("scope") != expected_scope:
        return None
    now = int(time.time())
    if int(payload.get("exp", 0)) < now:
        return None
    # Reject tokens claiming an iat far in the future (clock-skew forgery)
    if int(payload.get("iat", 0)) > now + 60:
        return None
    return payload


def issue_admin_token(
    ttl_seconds: int = 3600, role: str = "super_admin", actor: str = "admin_pin"
) -> Tuple[str, int]:
    tok = sign_token(
        {
            "scope": "admin",
            "role": role,
            "actor": actor,
            "jti": secrets.token_hex(12),
        },
        ttl_seconds,
    )
    return tok, ttl_seconds


def verify_admin_token(token: str) -> Optional[dict]:
    return verify_signed_token(token, "admin")


def issue_entitlement_token(
    access_key: str, plan: str, ttl_seconds: int = 86400 * 7
) -> str:
    return sign_token(
        {"scope": "entitlement", "key": access_key, "plan": plan}, ttl_seconds
    )


def verify_entitlement_token(token: str) -> Optional[dict]:
    return verify_signed_token(token, "entitlement")


def issue_user_token(
    user_id: int,
    email: str,
    role: str = "student",
    token_version: int = 1,
    ttl_seconds: int = 86400 * 7,
) -> str:
    return sign_token(
        {
            "scope": "user",
            "uid": int(user_id),
            "email": email.lower(),
            "role": role,
            "tv": int(token_version),
            "jti": secrets.token_hex(12),
        },
        ttl_seconds,
    )


def verify_user_token(token: str) -> Optional[dict]:
    return verify_signed_token(token, "user")


# -----------------------------------------------------------------------------
# INPUT SANITIZATION & URL ALLOWLISTING
# -----------------------------------------------------------------------------
_HTML_TAG_RE = re.compile(r"<[^>]*>")
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9.\-]{1,190}\.[A-Za-z]{2,24}$")
_DTE_CODE_RE = re.compile(r"^[0-9]{4,6}$")
_VALID_ROLES = {"student", "counsellor", "admin", "super_admin"}


def sanitize_text(val: Optional[str], max_len: int = 200) -> Optional[str]:
    if val is None:
        return None
    s = str(val)
    s = _CONTROL_CHAR_RE.sub("", s)
    s = _HTML_TAG_RE.sub("", s)
    s = s.replace("<", "").replace(">", "").strip()
    if len(s) > max_len:
        s = s[:max_len]
    return s or None


def sanitize_email(val: Optional[str]) -> Optional[str]:
    cleaned = sanitize_text(val, max_len=120)
    if not cleaned:
        return None
    if not _EMAIL_RE.match(cleaned):
        return None
    return cleaned.lower()


def sanitize_dte_code(val: Optional[str]) -> str:
    s = re.sub(r"[^0-9]", "", str(val or "").strip())
    return s if _DTE_CODE_RE.match(s) else ""


def sanitize_google_avatar_url(val: Optional[str]) -> Optional[str]:
    """Allow only HTTPS Google-hosted profile picture domains (prevents SSRF / tracking injection)."""
    raw = str(val or "").strip()
    if not raw or len(raw) > 512:
        return None
    try:
        parsed = urllib.parse.urlparse(raw)
        if parsed.scheme != "https":
            return None
        host = (parsed.hostname or "").lower()
        if not (host == "googleusercontent.com" or host.endswith(".googleusercontent.com")):
            return None
        return raw
    except Exception:
        return None


def mask_utr(utr: Optional[str]) -> str:
    s = str(utr or "").strip()
    if len(s) <= 4:
        return "****"
    return f"{'*' * (len(s) - 4)}{s[-4:]}"


def get_client_ip(request: Request) -> str:
    if TRUST_PROXY:
        xff = request.headers.get("x-forwarded-for", "")
        if xff:
            return xff.split(",")[0].strip()[:64]
    if request.client and request.client.host:
        return str(request.client.host)[:64]
    return "unknown"


# -----------------------------------------------------------------------------
# BRUTE-FORCE & CREDENTIAL-STUFFING GUARD (Per-IP + Global Progressive Lockout)
# -----------------------------------------------------------------------------
class AdminBruteForceGuard:
    def __init__(
        self,
        max_failures: int = 5,
        window_sec: int = 900,
        lockout_sec: int = 900,
        global_max_failures: int = 25,
    ):
        self.max_failures = max_failures
        self.window_sec = window_sec
        self.lockout_sec = lockout_sec
        self.global_max_failures = global_max_failures
        self._failures: Dict[str, deque] = defaultdict(deque)
        self._locked_until: Dict[str, float] = {}
        self._global_failures: deque = deque()
        self._global_locked_until: float = 0.0
        self._lock = threading.Lock()

    def check_locked(self, ip: str) -> Optional[int]:
        now = time.time()
        with self._lock:
            if self._global_locked_until > now:
                return int(self._global_locked_until - now) + 1
            until = self._locked_until.get(ip, 0.0)
            if until > now:
                return int(until - now) + 1
            if ip in self._locked_until:
                del self._locked_until[ip]
        return None

    def record_failure(self, ip: str) -> int:
        now = time.time()
        with self._lock:
            # Global credential-stuffing check across distributed IPs
            while self._global_failures and now - self._global_failures[0] > self.window_sec:
                self._global_failures.popleft()
            self._global_failures.append(now)
            if len(self._global_failures) >= self.global_max_failures:
                self._global_locked_until = now + self.lockout_sec

            q = self._failures[ip]
            while q and now - q[0] > self.window_sec:
                q.popleft()
            q.append(now)
            if len(q) >= self.max_failures:
                self._locked_until[ip] = now + self.lockout_sec
                q.clear()
                return 0
            return self.max_failures - len(q)

    def reset(self, ip: str) -> None:
        with self._lock:
            self._failures.pop(ip, None)
            self._locked_until.pop(ip, None)
            self._global_failures.clear()
            self._global_locked_until = 0.0


admin_guard = AdminBruteForceGuard()


# -----------------------------------------------------------------------------
# PERSISTENT SECURITY AUDIT LOGGER (Scrubs all secrets/tokens automatically)
# -----------------------------------------------------------------------------
def log_security_event(
    db,
    *,
    event_type: str,
    outcome: str = "success",
    severity: str = "info",
    actor_identity: Optional[str] = None,
    actor_role: Optional[str] = None,
    target_resource: Optional[str] = None,
    request: Optional[Request] = None,
    details: Optional[str] = None,
) -> None:
    """Persist structured security audit logs without ever storing passwords or tokens."""
    if db is None:
        return
    try:
        from .models import SecurityAuditLog

        ip = get_client_ip(request) if request is not None else None
        ua = (
            sanitize_text(request.headers.get("user-agent"), max_len=160)
            if request is not None
            else None
        )
        row = SecurityAuditLog(
            event_type=sanitize_text(event_type, max_len=64) or "event",
            severity=severity if severity in ("info", "warning", "critical") else "info",
            actor_identity=sanitize_text(actor_identity, max_len=120),
            actor_role=sanitize_text(actor_role, max_len=32),
            target_resource=sanitize_text(target_resource, max_len=120),
            ip_address=ip,
            user_agent=ua,
            outcome=outcome if outcome in ("success", "failure", "blocked") else "success",
            details=sanitize_text(details, max_len=400),
        )
        db.add(row)
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass


# -----------------------------------------------------------------------------
# SLIDING-WINDOW RATE LIMITER + BODY SIZE GUARD + OWASP SECURITY HEADERS
# -----------------------------------------------------------------------------
class SecurityMiddleware(BaseHTTPMiddleware):
    MAX_BODY_BYTES = 65_536  # 64 KB hard ceiling against memory DoS

    # (path_prefix, methods, max_requests, window_seconds)
    RATE_RULES = [
        ("/api/admin/login", {"POST"}, 8, 300),
        ("/api/admin/users/", {"POST"}, 20, 300),
        ("/api/auth/google", {"POST"}, 15, 300),
        ("/api/auth/logout", {"POST"}, 20, 60),
        ("/api/auth/sync", {"POST"}, 40, 60),
        ("/api/option-form/save", {"POST"}, 30, 60),
        ("/api/audit/export", {"POST"}, 30, 60),
        ("/api/payments/razorpay/create-order", {"POST"}, 15, 600),
        ("/api/payments/razorpay/verify", {"POST"}, 20, 300),
        ("/api/payments/submit", {"POST"}, 8, 600),
        ("/api/leads", {"POST"}, 8, 600),
        ("/api/payments/verify-token", {"POST"}, 30, 60),
        ("/api/payments/verify", {"GET"}, 10, 300),
        ("/api/what-if", {"POST"}, 30, 60),
        ("/api/betterment-radar", {"POST"}, 30, 60),
        ("/api/roi-finder", {"POST"}, 30, 60),
        ("/api/admin/", {"GET", "POST", "PUT", "DELETE"}, 60, 60),
        ("/api/", {"GET", "POST", "PUT", "DELETE"}, 180, 60),
    ]

    def __init__(self, app):
        super().__init__(app)
        self._buckets: Dict[Tuple[str, str], deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def reset_limits(self) -> None:
        with self._lock:
            self._buckets.clear()

    def _check_rate_limit(self, ip: str, path: str, method: str) -> Tuple[bool, int, int]:
        if os.environ.get("CAP_DISABLE_RATE_LIMIT") == "1":
            return True, 999, 0
        now = time.time()
        for prefix, methods, limit, window in self.RATE_RULES:
            if path.startswith(prefix) and method in methods:
                key = (ip, prefix)
                with self._lock:
                    q = self._buckets[key]
                    cutoff = now - window
                    while q and q[0] < cutoff:
                        q.popleft()
                    if len(q) >= limit:
                        retry_after = max(1, int(window - (now - q[0])) + 1)
                        return False, 0, retry_after
                    q.append(now)
                    return True, max(0, limit - len(q)), 0
        return True, 999, 0

    @staticmethod
    def _apply_security_headers(response, path: str) -> None:
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )
        response.headers["X-XSS-Protection"] = "0"
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'"
        )
        if (
            path.startswith("/api/admin")
            or path.startswith("/api/payments")
            or path.startswith("/api/auth")
            or path.startswith("/api/option-form/save")
        ):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method.upper()

        # 1. Request Payload Size Guard (anti-DoS)
        if method in ("POST", "PUT", "PATCH"):
            content_len = request.headers.get("content-length")
            if content_len:
                try:
                    if int(content_len) > self.MAX_BODY_BYTES:
                        resp = JSONResponse(
                            status_code=413,
                            content={"detail": "Request payload too large (max 64 KB)."},
                        )
                        self._apply_security_headers(resp, path)
                        return resp
                except ValueError:
                    pass

        # 2. Per-IP Rate Limiting
        ip = get_client_ip(request)
        if method != "OPTIONS":
            allowed, remaining, retry_after = self._check_rate_limit(ip, path, method)
            if not allowed:
                resp = JSONResponse(
                    status_code=429,
                    content={
                        "detail": f"Too many requests. Please try again in {retry_after} seconds."
                    },
                    headers={"Retry-After": str(retry_after)},
                )
                self._apply_security_headers(resp, path)
                return resp
        else:
            remaining = 999

        # 3. Call downstream route
        response = await call_next(request)
        self._apply_security_headers(response, path)
        if remaining < 999:
            response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
