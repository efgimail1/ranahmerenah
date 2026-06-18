from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from decimal import Decimal
from app.models.material import ReceiptType


# ─── Item Catalog ──────────────────────────────────────────
class ItemCatalogBase(BaseModel):
    name: str
    item_code: Optional[str] = None
    category: Optional[str] = None
    default_unit: Optional[str] = "pcs"
    description: Optional[str] = None
    notes: Optional[str] = None

class ItemCatalogCreate(ItemCatalogBase):
    pass

class ItemCatalogUpdate(BaseModel):
    name: Optional[str] = None
    item_code: Optional[str] = None
    category: Optional[str] = None
    default_unit: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None

class ItemCatalogResponse(ItemCatalogBase):
    id: int
    class Config:
        from_attributes = True


# ─── Supplier ──────────────────────────────────────────────
class SupplierBase(BaseModel):
    store_name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    notes: Optional[str] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    store_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    notes: Optional[str] = None

class SupplierResponse(SupplierBase):
    id: int
    class Config:
        from_attributes = True

# ─── Supplier Price List ───────────────────────────────────
class SupplierPriceListBase(BaseModel):
    supplier_id:     int
    catalog_item_id: Optional[int] = None
    item_name:       str
    unit:            Optional[str] = None
    price:           Decimal
    effective_date:  Optional[date] = None
    notes:           Optional[str] = None

class SupplierPriceListCreate(SupplierPriceListBase):
    pass

class SupplierPriceListUpdate(BaseModel):
    item_name:      Optional[str] = None
    unit:           Optional[str] = None
    price:          Optional[Decimal] = None
    effective_date: Optional[date] = None
    notes:          Optional[str] = None

class SupplierPriceListResponse(SupplierPriceListBase):
    id: int
    class Config:
        from_attributes = True

# ─── Purchase Item ─────────────────────────────────────────
class PurchaseItemCreate(BaseModel):
    catalog_item_id: Optional[int] = None
    item_name: str
    quantity: Decimal
    unit: Optional[str] = "pcs"
    unit_price: Optional[Decimal] = Decimal("0")
    discount_per_unit: Optional[Decimal] = Decimal("0")

class PurchaseItemResponse(PurchaseItemCreate):
    id: int
    order_id: int
    net_unit_price: Optional[Decimal] = None
    subtotal_gross: Optional[Decimal] = None
    subtotal_net: Optional[Decimal] = None
    discount_total: Optional[Decimal] = None
    class Config:
        from_attributes = True


# ─── Purchase Order ────────────────────────────────────────
class PurchaseOrderCreate(BaseModel):
    project_id: Optional[int] = None
    sub_project_id: Optional[int] = None
    supplier_id: Optional[int] = None
    purchase_date: date
    due_date : Optional[date] = None
    is_paid: Optional[bool] = False
    ordered_by: Optional[str] = None
    has_receipt: Optional[bool] = False
    receipt_type: Optional[ReceiptType] = None
    receipt_image_url: Optional[str] = None
    notes: Optional[str] = None
    items: List[PurchaseItemCreate] = []

class PurchaseOrderUpdate(BaseModel):
    project_id: Optional[int] = None
    sub_project_id: Optional[int] = None
    supplier_id: Optional[int] = None
    purchase_date: Optional[date] = None
    is_paid: Optional[bool] = None
    ordered_by: Optional[str] = None
    has_receipt: Optional[bool] = None
    receipt_type: Optional[ReceiptType] = None
    receipt_image_url: Optional[str] = None
    notes: Optional[str] = None

class PurchaseOrderResponse(BaseModel):
    id: int
    project_id:     Optional[int] = None
    sub_project_id: Optional[int] = None
    supplier_id:    Optional[int] = None
    purchase_date:  date
    due_date:       Optional[date] = None
    is_paid:        bool
    ordered_by:        Optional[str] = None
    has_receipt:    bool
    receipt_type:   Optional[ReceiptType] = None
    receipt_image_url: Optional[str] = None
    notes:          Optional[str] = None
    total_gross:    Optional[Decimal] = None
    total_discount: Optional[Decimal] = None
    total_net:      Optional[Decimal] = None
    items:          List[PurchaseItemResponse] = []
    payments:       List["POPaymentResponse"] = []
    total_paid:     Optional[Decimal] = Decimal("0")
    payment_status: Optional[str] = "unpaid"  # unpaid | partial | paid
    class Config:
        from_attributes = True


# ─── Material (legacy) ────────────────────────────────────
class MaterialBase(BaseModel):
    project_id: Optional[int] = None
    supplier_id: Optional[int] = None
    purchase_date: date
    item_name: str
    quantity: Decimal
    unit: Optional[str] = None
    unit_price: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = Decimal("0")
    is_paid: Optional[bool] = False
    ordered_by: Optional[str] = None
    has_receipt: Optional[bool] = False
    receipt_type: Optional[ReceiptType] = None
    notes: Optional[str] = None

class MaterialCreate(MaterialBase):
    pass

class MaterialUpdate(BaseModel):
    supplier_id: Optional[int] = None
    purchase_date: Optional[date] = None
    item_name: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    unit_price: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    is_paid: Optional[bool] = None
    ordered_by: Optional[str] = None
    has_receipt: Optional[bool] = None
    receipt_type: Optional[ReceiptType] = None
    receipt_image_url: Optional[str] = None
    notes: Optional[str] = None

class MaterialResponse(MaterialBase):
    id: int
    net_unit_price: Optional[Decimal] = None
    subtotal: Optional[Decimal] = None
    net_subtotal: Optional[Decimal] = None
    receipt_image_url: Optional[str] = None
    class Config:
        from_attributes = True

# ─── PO Payment ────────────────────────────────────────────

class POPaymentCreate(BaseModel):
    payment_date:   date
    amount:         Decimal
    paid_by:        Optional[str] = None
    bank_account:   Optional[str] = None
    payment_method: Optional[str] = "transfer"
    notes:          Optional[str] = None
    ledger_entry_id: Optional[int] = None

class POPaymentResponse(BaseModel):
    id:             int
    order_id:       int
    payment_date:   date
    amount:         Decimal
    paid_by:        Optional[str] = None
    bank_account:   Optional[str] = None
    payment_method: Optional[str] = None
    notes:          Optional[str] = None
    ledger_entry_id: Optional[int] = None   # ← tambah    

    class Config:
        from_attributes = True
