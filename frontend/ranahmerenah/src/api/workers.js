import api from './client'

export const workersApi = {
  getAll:   (params) => api.get('/workers', { params }).then(r => r.data),
  getById:  (id)     => api.get(`/workers/${id}`).then(r => r.data),
  create:   (data)   => api.post('/workers', data).then(r => r.data),
  update:   (id, data) => api.put(`/workers/${id}`, data).then(r => r.data),
  delete:   (id)     => api.delete(`/workers/${id}`),

  // Assignments
  getAssignments:    (workerId) => api.get(`/workers/${workerId}/assignments`).then(r => r.data),
  createAssignment:  (data)     => api.post('/workers/assignments', data).then(r => r.data),
  updateAssignment:  (id, data) => api.put(`/workers/assignments/${id}`, data).then(r => r.data),
  deleteAssignment:  (id)       => api.delete(`/workers/assignments/${id}`),

  // Wages
  getWages: (params) => api.get('/wages', { params }).then(r => r.data),
  getAllWages:  (params)   => api.get('/workers/wages/all', { params }).then(r => r.data),
  createWage:  (data)     => api.post('/workers/wages', data).then(r => r.data),
}