import api from './client'

export const timesheetsApi = {
  getAll: (params) => api.get('/timesheets', { params }).then(r => r.data),
  create: (data)   => api.post('/timesheets', data).then(r => r.data),
  update: (id, data) => api.put(`/timesheets/${id}`, data).then(r => r.data),
  delete: (id)     => api.delete(`/timesheets/${id}`),
 markPaid: (ids, wagePaymentId) =>
  api.post('/timesheets/mark-paid', {
    timesheet_ids:   ids.map(id => parseInt(id)),
    wage_payment_id: parseInt(wagePaymentId),
  }).then(r => r.data),
}