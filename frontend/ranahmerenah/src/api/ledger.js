import api from './client'

export const ledgerApi = {
  getAll:        (params) => api.get('/ledger', { params }).then(r => r.data),
  getSummary:    (params) => api.get('/ledger/summary', { params }).then(r => r.data),
  createIncome:  (data)   => api.post('/ledger/income', data).then(r => r.data),
  createExpense: (data)   => api.post('/ledger/expense', data).then(r => r.data),
  update:        (id, data) => api.put(`/ledger/${id}`, data).then(r => r.data),
  delete:        (id)     => api.delete(`/ledger/${id}`),
}