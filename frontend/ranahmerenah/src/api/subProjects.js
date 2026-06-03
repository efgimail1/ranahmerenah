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
}