from sqlalchemy import Column, Integer, String, Numeric, Text, Date, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
import enum

class WorkerRole(str, enum.Enum):
    foreman = "foreman"           # mandor
    carpenter = "carpenter"       # tukang kayu
    helper = "helper"             # kenek
    furniture_maker = "furniture_maker"   # tukang meubel
    bricklayer = "bricklayer"     # tukang batu
    painter = "painter"           # tukang cat
    electrician = "electrician"
    plumber = "plumber"
    other = "other"

class RateType(str, enum.Enum):
    daily = "daily"           # per hari
    per_unit = "per_unit"     # per unit (tukang meubel)
    fixed = "fixed"           # borongan

class Worker(Base):
    __tablename__ = "workers"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    phone = Column(String(20))
    role = Column(Enum(WorkerRole), nullable=False)
    rate_type = Column(Enum(RateType), default=RateType.daily)
    rate_amount = Column(Numeric(12, 2), nullable=False)
    is_active = Column(Boolean, default=True)
    notes = Column(Text)

    assignments = relationship("WorkerAssignment", back_populates="worker")
    wage_payments = relationship("WagePayment", back_populates="worker")


class WorkerAssignment(Base):
    __tablename__ = "worker_assignments"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    start_date = Column(Date)
    end_date = Column(Date)
    notes = Column(Text)

    worker = relationship("Worker", back_populates="assignments")
    project = relationship("Project", back_populates="worker_assignments")


class WagePayment(Base):
    __tablename__ = "wage_payments"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"))
    payment_date = Column(Date, nullable=False)
    days_worked = Column(Numeric(5, 1))        # untuk harian
    unit_count = Column(Numeric(8, 2))         # untuk per unit
    rate_snapshot = Column(Numeric(12, 2))     # rate saat dibayar (bisa berubah)
    gross_amount = Column(Numeric(12, 2))      # sebelum potongan
    deduction = Column(Numeric(12, 2), default=0)
    net_amount = Column(Numeric(12, 2))        # yang dibayarkan
    notes = Column(Text)

    worker = relationship("Worker", back_populates="wage_payments")
    ledger_entry = relationship("LedgerEntry", back_populates="wage_payment", uselist=False)