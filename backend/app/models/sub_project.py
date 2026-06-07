from sqlalchemy import Column, Integer, String, Numeric, Text, ForeignKey, DateTime, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class SubProject(Base):
    __tablename__ = "sub_projects"

    id          = Column(Integer, primary_key=True, index=True)
    project_id  = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name        = Column(String(200), nullable=False)
    description = Column(Text)
    rab_value   = Column(Numeric(15, 2), default=0)
    status      = Column(String(20), default="active")
    sort_order  = Column(Integer, default=0)
    start_date  = Column(Date)
    end_date    = Column(Date)
    created_at  = Column(DateTime, server_default=func.now())

    project  = relationship("Project", back_populates="sub_projects")
    billings = relationship(
        "SubProjectBilling",
        back_populates="sub_project",
        cascade="all, delete"
    )
    purchase_orders = relationship("PurchaseOrder", back_populates="sub_project")


class SubProjectBilling(Base):
    __tablename__ = "sub_project_billings"

    id             = Column(Integer, primary_key=True, index=True)
    sub_project_id = Column(Integer, ForeignKey("sub_projects.id"), nullable=False)
    billing_date   = Column(Date, nullable=False)
    amount         = Column(Numeric(15, 2), nullable=False)
    received_from  = Column(String(150))
    bank_account   = Column(String(50))
    payment_method = Column(String(20), default="transfer")
    notes          = Column(Text)
    created_at     = Column(DateTime, server_default=func.now())

    sub_project = relationship("SubProject", back_populates="billings")