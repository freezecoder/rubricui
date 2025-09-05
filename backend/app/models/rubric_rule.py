from sqlalchemy import Column, ForeignKey, Float, Integer, Boolean
from app.models.database import Base, UUIDType
import uuid

class RubricRule(Base):
    __tablename__ = "rubric_rules"
    
    id = Column(UUIDType, primary_key=True, default=lambda: uuid.uuid4().hex)
    rubric_id = Column(UUIDType, ForeignKey("rubrics.id", ondelete="CASCADE"), nullable=False)
    rule_id = Column(UUIDType, ForeignKey("rules.id", ondelete="CASCADE"), nullable=False)
    weight = Column(Float, default=1.0)
    order_index = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True)