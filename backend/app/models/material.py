from sqlalchemy import Column, Integer, String, Numeric, Text, Date, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class ReceiptType(str, enum.Enum):
    physical = "physical"
    digital = "digital"
    both = "both"


# ─── Master Data Barang ────────────────────────────────────
class ItemCatalog(Base):
    __tablename__ = "item_catalog"

    id = Column(Integer, primary_key=True, index=True)
    item_code = Column(String(50), unique=True, nullable=True)
    name = Column(String(200), nullable=False, unique=True)
    category = Column(String(100), nullable=True)
    default_unit = Column(String(30), default="pcs")
    description = Column(Text, nullable=True)
    notes = Column(Text)

    purchase_items = relationship("PurchaseItem", back_populates="catalog_item")


# ─── Supplier ──────────────────────────────────────────────
class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    store_name = Column(String(150), nullable=False)
    address = Column(String(255))
    phone = Column(String(20))
    contact_person = Column(String(100))
    notes = Column(Text)

    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")
    price_list = relationship("SupplierPriceList", back_populates="supplier", cascade="all, delete")


# ─── Supplier Price List ──────────────────────────────────────────────
class SupplierPriceList(Base):
    """Daftar harga barang per supplier — untuk perbandingan harga"""
    __tablename__ = "supplier_price_list"

    id              = Column(Integer, primary_key=True, index=True)
    supplier_id     = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    catalog_item_id = Column(Integer, ForeignKey("item_catalog.id"), nullable=True)
    item_name       = Column(String(200), nullable=False)
    unit            = Column(String(30))
    price           = Column(Numeric(15, 2), nullable=False)
    effective_date  = Column(Date)
    notes           = Column(Text)

    supplier     = relationship("Supplier", back_populates="price_list")
    catalog_item = relationship("ItemCatalog")


# Update Supplier — tambah relasi:
# price_list = relationship("SupplierPriceList", back_populates="supplier")

# Update PurchaseOrder — tambah kolom due_date & payment_link:
# due_date = Column(Date)
# linked_ledger_id = Column(Integer, ForeignKey("ledger_entries.id"), nullable=True)


# ─── Purchase Order (Header Nota) ─────────────────────────
class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id             = Column(Integer, primary_key=True, index=True)
    project_id     = Column(Integer, ForeignKey("projects.id"),     nullable=True)
    sub_project_id = Column(Integer, ForeignKey("sub_projects.id"), nullable=True)
    supplier_id    = Column(Integer, ForeignKey("suppliers.id"),    nullable=True)
    purchase_date  = Column(Date, nullable=False)
    is_paid        = Column(Boolean, default=False)
    ordered_by        = Column(String(150))
    has_receipt    = Column(Boolean, default=False)
    receipt_type   = Column(Enum(ReceiptType), nullable=True)
    receipt_image_url = Column(String(500), nullable=True)
    notes          = Column(Text)
    due_date       = Column(Date, nullable=True)
    linked_ledger_id = Column(Integer, nullable=True)

    total_gross    = Column(Numeric(15, 2), default=0)
    total_discount = Column(Numeric(15, 2), default=0)
    total_net      = Column(Numeric(15, 2), default=0)

    project     = relationship("Project",    back_populates="purchase_orders")
    sub_project = relationship("SubProject", back_populates="purchase_orders")
    supplier    = relationship("Supplier",   back_populates="purchase_orders")
    items       = relationship("PurchaseItem", back_populates="order",
                               cascade="all, delete-orphan")
    payments    = relationship("POPayment", back_populates="order",
                               cascade="all, delete-orphan",
                               order_by="POPayment.payment_date")
    ledger_entry = relationship("LedgerEntry", back_populates="purchase_order",
                                uselist=False)


# ─── Purchase Item (Detail Barang per Nota) ────────────────
class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    catalog_item_id = Column(Integer, ForeignKey("item_catalog.id"), nullable=True)
    item_name = Column(String(200), nullable=False)
    quantity = Column(Numeric(12, 3), nullable=False)
    unit = Column(String(30))
    unit_price = Column(Numeric(15, 2))           # harga di bon
    discount_per_unit = Column(Numeric(15, 2), default=0)  # diskon per satuan
    net_unit_price = Column(Numeric(15, 2))       # unit_price - discount
    subtotal_gross = Column(Numeric(15, 2))       # qty x unit_price
    subtotal_net = Column(Numeric(15, 2))         # qty x net_unit_price
    discount_total = Column(Numeric(15, 2), default=0)  # qty x discount

    order = relationship("PurchaseOrder", back_populates="items")
    catalog_item = relationship("ItemCatalog", back_populates="purchase_items")


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    purchase_date = Column(Date, nullable=False)
    item_name = Column(String(200), nullable=False)
    quantity = Column(Numeric(12, 3), nullable=False)
    unit = Column(String(30))
    unit_price = Column(Numeric(15, 2))
    discount_amount = Column(Numeric(15, 2), default=0)
    net_unit_price = Column(Numeric(15, 2))
    subtotal = Column(Numeric(15, 2))
    net_subtotal = Column(Numeric(15, 2))
    is_paid = Column(Boolean, default=False)
    ordered_by = Column(String(150))
    has_receipt = Column(Boolean, default=False)
    receipt_type = Column(Enum(ReceiptType))
    receipt_image_url = Column(String(500))
    notes = Column(Text)

    # ← tidak ada back_populates ke project karena Project tidak punya relasi materials lagi
    supplier = relationship("Supplier")
    ledger_entry = relationship("LedgerEntry", back_populates="material", uselist=False)

class POPayment(Base):
    """Partial/full payment records for a PurchaseOrder"""
    __tablename__ = "po_payments"

    id             = Column(Integer, primary_key=True, index=True)
    order_id       = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    payment_date   = Column(Date, nullable=False)
    amount         = Column(Numeric(15, 2), nullable=False)
    paid_by        = Column(String(150))
    bank_account   = Column(String(50))
    payment_method = Column(String(20), default="transfer")
    notes          = Column(Text)
    created_at     = Column(DateTime, server_default=func.now())
    ledger_entry_id = Column(Integer, ForeignKey("ledger_entries.id"), nullable=True)

    order = relationship("PurchaseOrder", back_populates="payments")