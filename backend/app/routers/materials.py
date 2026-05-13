from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from decimal import Decimal
from app.database import get_db
from app.models.material import Material, Supplier, ItemCatalog, PurchaseOrder, PurchaseItem
from app.schemas.material import (
    MaterialCreate, MaterialUpdate, MaterialResponse,
    SupplierCreate, SupplierUpdate, SupplierResponse,
    ItemCatalogCreate, ItemCatalogUpdate, ItemCatalogResponse,
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse,
)

router = APIRouter(tags=["Materials"])


# ─── Item Catalog ──────────────────────────────────────────
@router.get("/catalog", response_model=List[ItemCatalogResponse])
def get_catalog(db: Session = Depends(get_db)):
    return db.query(ItemCatalog).order_by(ItemCatalog.name).all()

@router.post("/catalog", response_model=ItemCatalogResponse,
             status_code=status.HTTP_201_CREATED)
def create_catalog_item(payload: ItemCatalogCreate, db: Session = Depends(get_db)):
    # cek duplikat
    existing = db.query(ItemCatalog).filter(
        ItemCatalog.name == payload.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Nama barang sudah ada di katalog")
    item = ItemCatalog(**payload.dict())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.put("/catalog/{item_id}", response_model=ItemCatalogResponse)
def update_catalog_item(item_id: int, payload: ItemCatalogUpdate, db: Session = Depends(get_db)):
    item = db.query(ItemCatalog).filter(ItemCatalog.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for f, v in payload.dict(exclude_unset=True).items():
        setattr(item, f, v)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/catalog/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_catalog_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(ItemCatalog).filter(ItemCatalog.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()


# ─── Suppliers ─────────────────────────────────────────────
@router.get("/suppliers", response_model=List[SupplierResponse])
def get_suppliers(db: Session = Depends(get_db)):
    return db.query(Supplier).order_by(Supplier.store_name).all()

@router.post("/suppliers", response_model=SupplierResponse,
             status_code=status.HTTP_201_CREATED)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db)):
    supplier = Supplier(**payload.dict())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier

@router.put("/suppliers/{supplier_id}", response_model=SupplierResponse)
def update_supplier(supplier_id: int, payload: SupplierUpdate, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for f, v in payload.dict(exclude_unset=True).items():
        setattr(supplier, f, v)
    db.commit()
    db.refresh(supplier)
    return supplier

@router.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    db.delete(supplier)
    db.commit()

@router.get("/suppliers/{supplier_id}/items")
def get_supplier_items(supplier_id: int, db: Session = Depends(get_db)):
    orders = db.query(PurchaseOrder).options(
        joinedload(PurchaseOrder.items)
    ).filter(PurchaseOrder.supplier_id == supplier_id).all()
    result = []
    for order in orders:
        for item in order.items:
            result.append({
                "id": item.id,
                "purchase_date": order.purchase_date,
                "item_name": item.item_name,
                "quantity": item.quantity,
                "unit": item.unit,
                "unit_price": item.unit_price,
                "discount_per_unit": item.discount_per_unit,
                "subtotal_gross": item.subtotal_gross,
                "subtotal_net": item.subtotal_net,
            })
    return result


# ─── Purchase Orders ───────────────────────────────────────
def _calc_item(item_data: dict) -> dict:
    unit_price = Decimal(str(item_data.get("unit_price") or 0))
    discount = Decimal(str(item_data.get("discount_per_unit") or 0))
    qty = Decimal(str(item_data.get("quantity") or 0))
    net_unit = unit_price - discount
    return {
        **item_data,
        "net_unit_price": net_unit,
        "subtotal_gross": qty * unit_price,
        "subtotal_net": qty * net_unit,
        "discount_total": qty * discount,
    }

@router.get("/purchase-orders", response_model=List[PurchaseOrderResponse])
def get_purchase_orders(
    project_id: Optional[int] = None,
    supplier_id: Optional[int] = None,
    is_paid: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(PurchaseOrder).options(joinedload(PurchaseOrder.items))
    if project_id:
        query = query.filter(PurchaseOrder.project_id == project_id)
    if supplier_id:
        query = query.filter(PurchaseOrder.supplier_id == supplier_id)
    if is_paid is not None:
        query = query.filter(PurchaseOrder.is_paid == is_paid)
    return query.order_by(PurchaseOrder.purchase_date.desc()).all()

@router.post("/purchase-orders", response_model=PurchaseOrderResponse,
             status_code=status.HTTP_201_CREATED)
def create_purchase_order(payload: PurchaseOrderCreate, db: Session = Depends(get_db)):
    items_data = payload.items
    order_data = payload.dict(exclude={"items"})

    order = PurchaseOrder(**order_data)
    db.add(order)
    db.flush()

    total_gross = Decimal("0")
    total_discount = Decimal("0")
    total_net = Decimal("0")

    for item_payload in items_data:
        calc = _calc_item(item_payload.dict())
        item = PurchaseItem(order_id=order.id, **calc)
        db.add(item)
        total_gross += calc["subtotal_gross"] or Decimal("0")
        total_discount += calc["discount_total"] or Decimal("0")
        total_net += calc["subtotal_net"] or Decimal("0")

    order.total_gross = total_gross
    order.total_discount = total_discount
    order.total_net = total_net

    db.commit()
    db.refresh(order)
    return order

@router.get("/purchase-orders/{order_id}", response_model=PurchaseOrderResponse)
def get_purchase_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(PurchaseOrder).options(
        joinedload(PurchaseOrder.items)
    ).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return order

@router.put("/purchase-orders/{order_id}", response_model=PurchaseOrderResponse)
def update_purchase_order(
    order_id: int,
    payload: PurchaseOrderCreate,  # pakai Create bukan Update supaya bisa terima items
    db: Session = Depends(get_db)
):
    order = db.query(PurchaseOrder).options(
        joinedload(PurchaseOrder.items)
    ).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # update header
    order.project_id = payload.project_id
    order.supplier_id = payload.supplier_id
    order.purchase_date = payload.purchase_date
    order.is_paid = payload.is_paid
    order.paid_by = payload.paid_by
    order.has_receipt = payload.has_receipt
    order.receipt_type = payload.receipt_type
    order.notes = payload.notes

    # hapus semua items lama lalu buat ulang
    for old_item in order.items:
        db.delete(old_item)
    db.flush()

    total_gross = Decimal("0")
    total_discount = Decimal("0")
    total_net = Decimal("0")

    for item_payload in payload.items:
        calc = _calc_item(item_payload.dict())
        item = PurchaseItem(order_id=order.id, **calc)
        db.add(item)
        total_gross += calc["subtotal_gross"] or Decimal("0")
        total_discount += calc["discount_total"] or Decimal("0")
        total_net += calc["subtotal_net"] or Decimal("0")

    order.total_gross = total_gross
    order.total_discount = total_discount
    order.total_net = total_net

    db.commit()
    db.refresh(order)
    return order

@router.delete("/purchase-orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    db.delete(order)
    db.commit()


# ─── Legacy Materials (tetap ada) ─────────────────────────
@router.get("/materials", response_model=List[MaterialResponse])
def get_materials(
    project_id: Optional[int] = None,
    is_paid: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Material)
    if project_id:
        query = query.filter(Material.project_id == project_id)
    if is_paid is not None:
        query = query.filter(Material.is_paid == is_paid)
    return query.order_by(Material.purchase_date.desc()).all()

@router.post("/materials", response_model=MaterialResponse,
             status_code=status.HTTP_201_CREATED)
def create_material(payload: MaterialCreate, db: Session = Depends(get_db)):
    data = payload.dict()
    unit_price = data.get("unit_price") or Decimal("0")
    discount = data.get("discount_amount") or Decimal("0")
    quantity = data.get("quantity") or Decimal("0")
    data["net_unit_price"] = unit_price - discount
    data["subtotal"] = quantity * unit_price
    data["net_subtotal"] = quantity * (unit_price - discount)
    material = Material(**data)
    db.add(material)
    db.commit()
    db.refresh(material)
    return material

@router.delete("/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(material_id: int, db: Session = Depends(get_db)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    db.delete(material)
    db.commit()