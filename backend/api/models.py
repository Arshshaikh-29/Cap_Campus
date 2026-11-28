from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, Index, Integer, String, Text
from .database import Base, AppDataBase


class CollegeRecord(Base):
    __tablename__ = "college_records"

    id = Column(Integer, primary_key=True, index=True)
    college_code = Column(String, index=True)
    college_name = Column(String, index=True)
    city = Column(String, index=True)
    choice_code = Column(String, index=True)
    branch_name = Column(String, index=True)
    quota_level = Column(String)
    stage = Column(String)
    category = Column(String, index=True)
    merit_rank = Column(Float, nullable=True)
    percentile = Column(Float, nullable=True)
    year = Column(Integer, index=True)
    round_number = Column(Integer, index=True)

    __table_args__ = (
        Index('idx_college_branch_category', 'college_code', 'branch_name', 'category'),
    )


class PaymentOrder(AppDataBase):
    __tablename__ = "payment_orders"

    id = Column(Integer, primary_key=True, index=True)
    access_key = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=False, index=True)
    email = Column(String, nullable=True, index=True)
    plan = Column(String, nullable=False)  # "pro" or "vip"
    amount_inr = Column(Integer, nullable=False)
    utr_number = Column(String, unique=True, index=True, nullable=False)
    payment_method = Column(String, default="GPay (9920627188)")
    status = Column(String, default="pending", index=True)  # pending | approved | rejected
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    approved_at = Column(DateTime, nullable=True)


class CounsellingLead(AppDataBase):
    __tablename__ = "counselling_leads"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=False, index=True)
    score_info = Column(String, nullable=True)
    category = Column(String, nullable=True)
    preferred_branch = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    status = Column(String, default="new", index=True)  # new | contacted | resolved
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class UserAccount(AppDataBase):
    __tablename__ = "user_accounts"

    id = Column(Integer, primary_key=True, index=True)
    google_sub = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    # Strict Server-Side RBAC & Session Controls (NEVER writable by client)
    role = Column(String, default="student", nullable=False, index=True)  # student | counsellor | admin | super_admin
    is_active = Column(Boolean, default=True, nullable=False)
    token_version = Column(Integer, default=1, nullable=False)
    saved_input_type = Column(String, default="percentile")
    saved_score = Column(Float, nullable=True)
    saved_category = Column(String, default="GOPENS")
    bookmarks_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class SavedOptionForm(AppDataBase):
    __tablename__ = "saved_option_forms"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    title = Column(String, nullable=False, default="My 2026 CAP Option Form")
    category = Column(String, nullable=False, default="GOPENS")
    score_label = Column(String, nullable=True)
    choices_json = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class RevokedToken(AppDataBase):
    """Server-side JTI revocation blocklist (defeats session hijacking & replay)."""
    __tablename__ = "revoked_tokens"

    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String, unique=True, index=True, nullable=False)
    scope = Column(String, nullable=False, default="user")
    expires_at = Column(Integer, nullable=False, index=True)
    revoked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class SecurityAuditLog(AppDataBase):
    """Immutable security monitoring & compliance audit log (never stores secrets/tokens)."""
    __tablename__ = "security_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    severity = Column(String, nullable=False, default="info", index=True)  # info | warning | critical
    actor_identity = Column(String, nullable=True, index=True)
    actor_role = Column(String, nullable=True)
    target_resource = Column(String, nullable=True)
    ip_address = Column(String, nullable=True, index=True)
    user_agent = Column(String, nullable=True)
    outcome = Column(String, nullable=False, default="success")  # success | failure | blocked
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
