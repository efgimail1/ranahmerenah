import api from './client'

export const materialsApi = {
  // Catalog
  getCatalog: () => api.get('/catalog').then(r => r.data),
  createCatalogItem: (data) => api.post('/catalog', data).then(r => r.data),
  updateCatalogItem: (id, data) => api.put(`/catalog/${id}`, data).then(r => r.data),
  deleteCatalogItem: (id) => api.delete(`/catalog/${id}`),

  // Suppliers
  getSuppliers: () => api.get('/suppliers').then(r => r.data),
  createSupplier: (data) => api.post('/suppliers', data).then(r => r.data),
  updateSupplier: (id, data) => api.put(`/suppliers/${id}`, data).then(r => r.data),
  deleteSupplier: (id) => api.delete(`/suppliers/${id}`),
  getSupplierItems: (id) => api.get(`/suppliers/${id}/items`).then(r => r.data),

  // Purchase Orders
  getPurchaseOrders: (params) => api.get('/purchase-orders', { params }).then(r => r.data),
  getPurchaseOrder: (id) => api.get(`/purchase-orders/${id}`).then(r => r.data),
  createPurchaseOrder: (data) => api.post('/purchase-orders', data).then(r => r.data),
  updatePurchaseOrder: (id, data) => api.put(`/purchase-orders/${id}`, data).then(r => r.data),
  deletePurchaseOrder: (id) => api.delete(`/purchase-orders/${id}`),

  // Legacy
  getAll: (params) => api.get('/materials', { params }).then(r => r.data),
  delete: (id) => api.delete(`/materials/${id}`),
}