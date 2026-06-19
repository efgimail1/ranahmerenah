import api from './client'

export const subProjectsApi = {
  getByProject: (projectId) =>
    api.get(`/sub-projects/project/${projectId}`).then(r => r.data),

  getById: (id) =>
    api.get(`/sub-projects/${id}`).then(r => r.data),

  create: (data) =>
    api.post('/sub-projects/', data).then(r => r.data),

  update: (id, data) =>
    api.put(`/sub-projects/${id}`, data).then(r => r.data),

  delete: (id) =>
    api.delete(`/sub-projects/${id}`),

  // Billings
  getBillings: (spId) =>
    api.get(`/sub-projects/${spId}/billings`).then(r => r.data),

  createBilling: (spId, data) =>
    api.post(`/sub-projects/${spId}/billings`, data).then(r => r.data),

  deleteBilling: (spId, billingId) =>
    api.delete(`/sub-projects/${spId}/billings/${billingId}`),

    // Kasbon Tukang
  getKasbons:    (spId)        => api.get(`/sub-projects/${spId}/kasbons`).then(r => r.data),
  createKasbon:  (spId, data)  => api.post(`/sub-projects/${spId}/kasbons`, data).then(r => r.data),
  deleteKasbon:  (spId, id)    => api.delete(`/sub-projects/${spId}/kasbons/${id}`),

  // Kasbon Kontraktor
  getContractorKasbons:   (spId)       => api.get(`/sub-projects/${spId}/contractor-kasbons`).then(r => r.data),
  createContractorKasbon: (spId, data) => api.post(`/sub-projects/${spId}/contractor-kasbons`, data).then(r => r.data),
  deleteContractorKasbon: (spId, id)   => api.delete(`/sub-projects/${spId}/contractor-kasbons/${id}`),


  // Worker Kasbons
  getWorkerKasbons: (spId, status) => api.get(`/sub-projects/${spId}/worker-kasbons`, { params: status ? { kasbon_status: status } : {}}).then(r => r.data),
  createWorkerKasbon:  (spId, data)      => api.post(`/sub-projects/${spId}/worker-kasbons`, data).then(r => r.data),
  updateWorkerKasbon:  (spId, id, data)  => api.patch(`/sub-projects/${spId}/worker-kasbons/${id}`, data).then(r => r.data),
  deleteWorkerKasbon:  (spId, id)        => api.delete(`/sub-projects/${spId}/worker-kasbons/${id}`),

  // Petty Cash (Kas Tukang)
getPettyCash: (spId, pcStatus) =>
  api.get(`/sub-projects/${spId}/petty-cash`, {
    params: pcStatus ? { pc_status: pcStatus } : {},
  }).then((r) => r.data),

createPettyCash: (spId, data) =>
  api.post(`/sub-projects/${spId}/petty-cash`, data).then((r) => r.data),

deletePettyCash: (spId, pcId) =>
  api.delete(`/sub-projects/${spId}/petty-cash/${pcId}`),

settlePettyCash: (spId, pcId, data) =>
  api.post(`/sub-projects/${spId}/petty-cash/${pcId}/settle`, data).then((r) => r.data),
}