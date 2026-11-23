from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Index, DateTime, Text
from .database import Base


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


class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    id = Column(Integer, primary_key=True, index=True)
    access_key = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=False, index=True)
    email = Column(String, nullable=True)
    plan = Column(String, nullable=False)  # "pro" or "vip"
    amount_inr = Column(Integer, nullable=False)
    utr_number = Column(String, unique=True, index=True, nullable=False)
    payment_method = Column(String, default="GPay (9920627188)")
    status = Column(String, default="pending", index=True)  # pending | approved | rejected
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    approved_at = Column(DateTime, nullable=True)


class CounsellingLead(Base):
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


class UserAccount(Base):
    __tablename__ = "user_accounts"

    id = Column(Integer, primary_key=True, index=True)
    google_sub = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    saved_input_type = Column(String, default="percentile")
    saved_score = Column(Float, nullable=True)
    saved_category = Column(String, default="GOPENS")
    bookmarks_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
