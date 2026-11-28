import os
from pathlib import Path
from typing import Dict
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "cap_compass.sqlite3"


def _load_root_dotenv() -> None:
    """Ensure .env is loaded before inspecting DATABASE_URL (without overriding real env vars)."""
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


_load_root_dotenv()

# -----------------------------------------------------------------------------
# 1. READ-ONLY CUTOFF ENGINE (198,336 verified 2023-2026 CAP cutoff records)
#    Kept in local SQLite for sub-millisecond cutoff lookups & zero cloud bloat.
# -----------------------------------------------------------------------------
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 15},
    pool_pre_ping=True,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    try:
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
        except Exception:
            pass
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=5000")
    finally:
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -----------------------------------------------------------------------------
# 2. PERSISTENT APP DATABASE ENGINE (Users, Shortlists, Orders, Leads, Forms)
#    Uses Cloud PostgreSQL when DATABASE_URL / APP_DATABASE_URL is configured
#    (Neon / Supabase / Render PostgreSQL), ensuring data NEVER resets on deploy
#    or Render free-tier sleep. Falls back cleanly to SQLite for local dev/tests.
# -----------------------------------------------------------------------------
AppDataBase = declarative_base()


def normalize_database_url(raw_url: str) -> str:
    url = (raw_url or "").strip()
    if not url:
        return ""
    if url.startswith("postgres://"):
        url = "postgresql+psycopg2://" + url[len("postgres://") :]
    elif url.startswith("postgresql://") and "+psycopg2" not in url.split("://", 1)[0]:
        url = "postgresql+psycopg2://" + url[len("postgresql://") :]
    # Cloud Postgres providers (Neon, Supabase, Render) require SSL
    if url.startswith("postgresql"):
        is_local = ("@localhost" in url) or ("@127.0.0.1" in url)
        if not is_local and "sslmode=" not in url:
            sep = "&" if "?" in url else "?"
            url = f"{url}{sep}sslmode=require"
    return url


def _build_app_engine(raw_url: str):
    norm_url = normalize_database_url(raw_url)
    if not norm_url:
        return engine, SessionLocal, False, "sqlite"

    if norm_url.startswith("sqlite"):
        eng = create_engine(
            norm_url,
            connect_args={"check_same_thread": False, "timeout": 15},
            pool_pre_ping=True,
        )
        sess = sessionmaker(autocommit=False, autoflush=False, bind=eng)
        return eng, sess, True, "sqlite_custom"

    eng = create_engine(
        norm_url,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=5,
        max_overflow=10,
    )
    sess = sessionmaker(autocommit=False, autoflush=False, bind=eng)
    return eng, sess, True, "postgresql"


_RAW_APP_DB_URL = (
    os.environ.get("APP_DATABASE_URL", "").strip()
    or os.environ.get("DATABASE_URL", "").strip()
)

app_engine, AppSessionLocal, IS_PERSISTENT_APP_DB, APP_DB_BACKEND = _build_app_engine(
    _RAW_APP_DB_URL
)


def get_app_db():
    db = AppSessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_storage_info() -> Dict[str, object]:
    """Non-sensitive storage diagnostics for /api/health and /api/admin/overview."""
    if APP_DB_BACKEND == "postgresql":
        return {
            "persistent_cloud_db": True,
            "engine": "postgresql",
            "mode": "postgresql_persistent",
            "label": "Cloud PostgreSQL (Permanent Storage Active)",
        }
    if APP_DB_BACKEND == "sqlite_custom":
        return {
            "persistent_cloud_db": True,
            "engine": "sqlite_custom",
            "mode": "sqlite_persistent_custom",
            "label": "Custom SQLite Storage",
        }
    return {
        "persistent_cloud_db": False,
        "engine": "sqlite",
        "mode": "sqlite_local",
        "label": "Local SQLite (Set DATABASE_URL on Render for Permanent Cloud Storage)",
    }
