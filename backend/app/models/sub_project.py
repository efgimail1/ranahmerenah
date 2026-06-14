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
    purchase_orders = relationship("PurchaseOrder", back_populates="sub_project")
    billings = relationship(
        "SubProjectBilling",
        back_populates="sub_project",
        cascade="all, delete"
    )
    kasbons            = relationship("Kasbon", back_populates="sub_project",
                                  cascade="all, delete-orphan")
    contractor_kasbons = relationship("ContractorKasbon", back_populates="sub_project",
                                  cascade="all, delete-orphan")
    worker_kasbons     = relationship("WorkerKasbon", back_populates="sub_project",
                                  cascade="all, delete-orphan")


class SubProjectBilling(Base):
    __tablename__ = "sub_project_billings"

    id             = Column(Integer, primary_key=True, index=True)
    sub_project_id = Column(Integer, ForeignKey("sub_projects.id"), nullable=False)
    billing_date   = Column(Date, nullable=False)
    amount         = Column(Numeric(15, 2), nullable=False)   # gross transfer
    qris_fee       = Column(Numeric(15, 2), default=0)        # potongan QRIS 0.3%
    net_amount     = Column(Numeric(15, 2), nullable=True)    # yg benar2 masuk
    received_from  = Column(String(150))
    bank_account   = Column(String(50))
    payment_method = Column(String(20), default="transfer")
    notes          = Column(Text)                             # catatan bebas
    created_at     = Column(DateTime, server_default=func.now())

    sub_project = relationship("SubProject", back_populates="billings")
    
    
class Kasbon(Base):
    __tablename__ = "kasbons"

    id             = Column(Integer, primary_key=True, index=True)
    sub_project_id = Column(Integer, ForeignKey("sub_projects.id"), nullable=False)
    week_start     = Column(Date, nullable=False)
    week_end       = Column(Date, nullable=False)
    amount         = Column(Numeric(12, 2), default=0)
    notes          = Column(Text)
    created_at     = Column(DateTime, server_default=func.now())

    sub_project = relationship("SubProject", back_populates="kasbons")


class ContractorKasbon(Base):
    __tablename__ = "contractor_kasbons"

    id             = Column(Integer, primary_key=True, index=True)
    sub_project_id = Column(Integer, ForeignKey("sub_projects.id"), nullable=False)
    kasbon_date    = Column(Date, nullable=False)
    amount         = Column(Numeric(12, 2), nullable=False)
    notes          = Column(Text)
    created_at     = Column(DateTime, server_default=func.now())

    sub_project = relationship("SubProject", back_populates="contractor_kasbons")
    
    
class WorkerKasbon(Base):
    __tablename__ = "worker_kasbons"

    id             = Column(Integer, primary_key=True, index=True)
    sub_project_id = Column(Integer, ForeignKey("sub_projects.id"), nullable=False)
    kasbon_date    = Column(Date, nullable=False)
    amount         = Column(Numeric(12, 2), nullable=False)
    transferred_by = Column(String(150))
    transferred_to = Column(String(150))
    bank_account   = Column(String(50))
    notes          = Column(Text)
    status         = Column(String(20), default="pending")
    payroll_ref    = Column(String(100))
    created_at     = Column(DateTime, server_default=func.now())

    sub_project = relationship("SubProject", back_populates="worker_kasbons")    