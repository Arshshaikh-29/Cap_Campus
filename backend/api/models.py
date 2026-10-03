from sqlalchemy import Column, Integer, String, Float, Index
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
