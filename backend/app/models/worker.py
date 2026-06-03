from sqlalchemy import Column, Integer, String, Numeric, Text, Date, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
import enum

class WorkerRole(str, enum.Enum):
    foreman          = "foreman"
    carpenter        = "carpenter"
    helper           = "helper"
    furniture_maker  = "furniture_maker"
    bricklayer       = "bricklayer"
    painter          = "painter"
    electrician      = "electrician"
    plumber          = "plumber"
    other            = "other"

class RateType(str, enum.Enum):
    daily    = "daily"
    per_unit = "per_unit"
    fixed    = "fixed"

class Worker(Base):
    __tablename__ = "workers"

    id          = Column(Integer, primary_key=True, index=True)
    full_name   = Column(String(150), nullable=False)
    phone       = Column(String(20))
    role        = Column(Enum(WorkerRole), nullable=False)
    rate_type   = Column(Enum(RateType), default=RateType.daily)
    rate_amount = Column(Numeric(12, 2), default=0)
    is_active   = Column(Boolean, default=True)
    notes       = Column(Text)

    assignments   = relationship("WorkerAssignment", back_populates="worker")
    wage_payments = relationship("WagePayment", back_populates="worker")


class WorkerAssignment(Base):
    """Tukang di-assign ke proyek tertentu dengan rate & tipe upah spesifik"""
    __tablename__ = "worker_assignments"

    id         = Column(Integer, primary_key=True, index=True)
    worker_id  = Column(Integer, ForeignKey("workers.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    sub_project_id = Column(Integer, ForeignKey("sub_projects.id"), nullable=True)
    rate_type  = Column(Enum(RateType), default=RateType.daily)
    rate_amount= Column(Numeric(12, 2), nullable=False)
    start_date = Column(Date)
    end_date   = Column(Date)
    is_active  = Column(Boolean, default=True)
    notes      = Column(Text)

    worker  = relationship("Worker", back_populates="assignments")
    project = relationship("Project", back_populates="worker_assignments")
    wage_payments = relationship("WagePayment", back_populates="assignment")


class WagePayment(Base):
    __tablename__ = "wage_payments"

    id            = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("worker_assignments.id"), nullable=True)
    worker_id     = Column(Integer, ForeignKey("workers.id"), nullable=False)
    project_id    = Column(Integer, ForeignKey("projects.id"), nullable=True)
    sub_project_id    = Column(Integer, ForeignKey("sub_projects.id"), nullable=True)
    payment_date  = Column(Date, nullable=False)
    period_start  = Column(Date)           # periode kerja dari
    period_end    = Column(Date)           # periode kerja sampai
    days_worked   = Column(Numeric(5, 1))
    unit_count    = Column(Numeric(8, 2))
    rate_snapshot = Column(Numeric(12, 2))
    gross_amount  = Column(Numeric(12, 2))
    deduction     = Column(Numeric(12, 2), default=0)
    net_amount    = Column(Numeric(12, 2))
    notes         = Column(Text)

    assignment = relationship("WorkerAssignment", back_populates="wage_payments")
    worker     = relationship("Worker", back_populates="wage_payments")
    ledger_entry = relationship("LedgerEntry", back_populates="wage_payment", uselist=False)