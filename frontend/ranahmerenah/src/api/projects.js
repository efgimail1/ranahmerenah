import api from './client'

export const projectsApi = {
  getAll: (params) => api.get('/projects', { params }).then(r => r.data),
  getById: (id) => api.get(`/projects/${id}`).then(r => r.data),
  create: (data) => api.post('/projects', data).then(r => r.data),
  update: (id, data) => api.put(`/projects/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/projects/${id}`),

  getPayments: (projectId) =>
    api.get(`/projects/${projectId}/payments`).then(r => r.data),
  addPayment: (projectId, data) =>
    api.post(`/projects/${projectId}/payments`, data).then(r => r.data),
  updatePayment: (paymentId, data) =>
    api.put(`/projects/payments/${paymentId}`, data).then(r => r.data),
  deletePayment: (paymentId) =>
    api.delete(`/projects/payments/${paymentId}`),
}