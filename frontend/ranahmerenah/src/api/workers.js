import api from './client'

export const workersApi = {
  getAll: (params) => api.get('/workers', { params }).then(r => r.data),
  getById: (id) => api.get(`/workers/${id}`).then(r => r.data),
  create: (data) => api.post('/workers', data).then(r => r.data),
  update: (id, data) => api.put(`/workers/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/workers/${id}`),

  // wages
  getWages: (workerId) => api.get(`/workers/${workerId}/wages`).then(r => r.data),
  createWage: (data) => api.post('/workers/wages', data).then(r => r.data),
}