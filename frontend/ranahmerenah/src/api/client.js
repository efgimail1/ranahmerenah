import axios from 'axios'

export const baseURL = 'http://localhost:8000'

const api = axios.create({
  baseURL: baseURL,
  headers: { 'Content-Type': 'application/json' },
})

// response interceptor — handle error global
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || 'Terjadi kesalahan'
    return Promise.reject(new Error(msg))
  }
)

export default api