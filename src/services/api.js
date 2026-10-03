import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api', // Backend is running on port 5000
});

// You can add interceptors for auth, error handling, etc.
api.interceptors.response.use(
  response => response,
  error => {
    // Handle errors globally if needed
    return Promise.reject(error);
  }
);

export default api;