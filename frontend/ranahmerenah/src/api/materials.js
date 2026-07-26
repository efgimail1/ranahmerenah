import api from './client'

export const materialsApi = {
  // Catalog
  getCatalog:       ()         => api.get('/catalog').then(r => r.data),
  createCatalogItem:(data)     => api.post('/catalog', data).then(r => r.data),
  updateCatalogItem:(id, data) => api.put(`/catalog/${id}`, data).then(r => r.data),
  deleteCatalogItem:(id)       => api.delete(`/catalog/${id}`),

  // Suppliers
  getSuppliers:     ()         => api.get('/suppliers').then(r => r.data),
  createSupplier:   (data)     => api.post('/suppliers', data).then(r => r.data),
  updateSupplier:   (id, data) => api.put(`/suppliers/${id}`, data).then(r => r.data),
  deleteSupplier:   (id)       => api.delete(`/suppliers/${id}`),
  getSupplierItems: (id)       => api.get(`/suppliers/${id}/items`).then(r => r.data),

  // Supplier Price List
  getSupplierPrices:   (supplierId)       => api.get(`/suppliers/${supplierId}/prices`).then(r => r.data),
  addSupplierPrice:    (supplierId, data) => api.post(`/suppliers/${supplierId}/prices`, data).then(r => r.data),
  updateSupplierPrice: (priceId, data)    => api.put(`/supplier-prices/${priceId}`, data).then(r => r.data),
  deleteSupplierPrice: (priceId)          => api.delete(`/supplier-prices/${priceId}`),
  comparePrices:       (params)           => api.get('/prices/compare', { params }).then(r => r.data),

  // Purchase Orders
  getPurchaseOrders:   (params)   => api.get('/purchase-orders', { params }).then(r => r.data),
  getPurchaseOrder:    (id)       => api.get(`/purchase-orders/${id}`).then(r => r.data),
  createPurchaseOrder: (data)     => api.post('/purchase-orders', data).then(r => r.data),
  updatePurchaseOrder: (id, data) => api.put(`/purchase-orders/${id}`, data).then(r => r.data),
  deletePurchaseOrder: (id)       => api.delete(`/purchase-orders/${id}`),

  // PO Payments (partial payment)
  getPOPayments:    (orderId)        => api.get(`/purchase-orders/${orderId}/payments`).then(r => r.data),
  addPOPayment:     (orderId, data)  => api.post(`/purchase-orders/${orderId}/payments`, data).then(r => r.data),
  deletePOPayment:  (orderId, payId) => api.delete(`/purchase-orders/${orderId}/payments/${payId}`),

  // PO Batch Payment (bayar beberapa PO sekaligus, 1 supplier, 1 ledger entry)
  createBatchPayment: (data) => api.post('/purchase-orders/batch-payments', data).then(r => r.data),

  // Legacy
  getAll: (params) => api.get('/materials', { params }).then(r => r.data),
  delete: (id)     => api.delete(`/materials/${id}`),

  // Purchase Order Receipt Upload
uploadReceipt: (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/purchase-orders/upload-receipt', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data) // { url: "/uploads/receipts/xxxx.jpg" }
},
}