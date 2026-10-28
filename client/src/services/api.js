const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Custom fetch wrapper to send JSON and support both:
 * 1. Bearer token in Authorization header
 * 2. credentials: 'include' for HttpOnly cookies
 */
export async function apiRequest(endpoint, { method = 'GET', body, token } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  };

  const storedToken = token || localStorage.getItem('imovies_token');
  if (storedToken) {
    headers['Authorization'] = `Bearer ${storedToken}`;
  }

  const config = {
    method,
    headers,
    credentials: 'include', // Includes HttpOnly cookies across origins if configured
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, config);
  } catch (netErr) {
    const error = new Error(
      netErr.message || 'Unable to connect to the server. Please check your internet connection or server status.'
    );
    error.status = 0;
    error.isNetworkError = true;
    throw error;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const authAPI = {
  register: (userData) => apiRequest('/auth/register', { method: 'POST', body: userData }),
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: credentials }),
  getMe: () => apiRequest('/auth/me'),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
};

export const movieAPI = {
  /**
   * Fetch movies with optional filters, search, sorting, and pagination
   * @param {Object} params - { search, genre, language, status, trending, minRating, sort, page, limit }
   */
  getMovies: (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, val);
      }
    });
    const qs = searchParams.toString();
    return apiRequest(`/movies${qs ? `?${qs}` : ''}`);
  },

  /**
   * Fetch single movie details by MongoDB ID
   * @param {string} id
   */
  getMovieById: (id) => apiRequest(`/movies/${encodeURIComponent(id)}`),

  /**
   * Create movie (Admin only)
   */
  createMovie: (movieData) => apiRequest('/movies', { method: 'POST', body: movieData }),

  /**
   * Update movie (Admin only)
   */
  updateMovie: (id, updates) => apiRequest(`/movies/${encodeURIComponent(id)}`, { method: 'PATCH', body: updates }),

  /**
   * Delete or deactivate movie (Admin only)
   */
  deleteMovie: (id, { soft = false } = {}) =>
    apiRequest(`/movies/${encodeURIComponent(id)}${soft ? '?soft=true' : ''}`, { method: 'DELETE' }),
};

export const theatreAPI = {
  /**
   * List theatres with optional city filter & search
   * @param {Object} params - { city, search }
   */
  getTheatres: (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, val);
      }
    });
    const qs = searchParams.toString();
    return apiRequest(`/theatres${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get single theatre by ID
   * @param {string} id
   */
  getTheatreById: (id) => apiRequest(`/theatres/${encodeURIComponent(id)}`),

  /**
   * Get screens belonging to a theatre
   * @param {string} id
   */
  getTheatreScreens: (id) => apiRequest(`/theatres/${encodeURIComponent(id)}/screens`),

  /**
   * Create theatre (Admin only)
   */
  createTheatre: (theatreData) => apiRequest('/theatres', { method: 'POST', body: theatreData }),

  /**
   * Update theatre (Admin only)
   */
  updateTheatre: (id, updates) => apiRequest(`/theatres/${encodeURIComponent(id)}`, { method: 'PATCH', body: updates }),

  /**
   * Delete theatre (Admin only)
   */
  deleteTheatre: (id, { soft = true } = {}) =>
    apiRequest(`/theatres/${encodeURIComponent(id)}${soft ? '?soft=true' : ''}`, { method: 'DELETE' }),

  /**
   * Create screen in a theatre (Admin only)
   */
  createScreen: (theatreId, screenData) =>
    apiRequest(`/theatres/${encodeURIComponent(theatreId)}/screens`, { method: 'POST', body: screenData }),
};

export const showtimeAPI = {
  /**
   * List showtimes filtered by movie, date, and theatre
   * @param {Object} params - { movieId, theatreId, date }
   */
  getShowtimes: (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, val);
      }
    });
    const qs = searchParams.toString();
    return apiRequest(`/showtimes${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get single showtime details by ID
   * @param {string} id
   */
  getShowtimeById: (id) => apiRequest(`/showtimes/${encodeURIComponent(id)}`),

  /**
   * Create showtime (Admin only)
   */
  createShowtime: (showtimeData) => apiRequest('/showtimes', { method: 'POST', body: showtimeData }),

  /**
   * Update showtime (Admin only)
   */
  updateShowtime: (id, updates) =>
    apiRequest(`/showtimes/${encodeURIComponent(id)}`, { method: 'PATCH', body: updates }),

  /**
   * Delete showtime (Admin only)
   */
  deleteShowtime: (id, { soft = true } = {}) =>
    apiRequest(`/showtimes/${encodeURIComponent(id)}${soft ? '?soft=true' : ''}`, { method: 'DELETE' }),
};

export const bookingAPI = {
  /**
   * Get seat availability for a showtime (public)
   * @param {string} showtimeId
   */
  getSeatAvailability: (showtimeId) =>
    apiRequest(`/bookings/availability/${encodeURIComponent(showtimeId)}`),

  /**
   * Create a booking (authenticated)
   * @param {string} showtimeId
   * @param {string[]} seatIds  e.g. ['A1', 'B3']
   */
  createBooking: (showtimeId, seatIds) =>
    apiRequest('/bookings', { method: 'POST', body: { showtimeId, seatIds } }),

  /**
   * Get the authenticated user's booking history
   */
  getMyBookings: () => apiRequest('/bookings/my'),

  /**
   * Get a single booking by ID (must be owned by the current user)
   * @param {string} id
   */
  getBookingById: (id) => apiRequest(`/bookings/${encodeURIComponent(id)}`),

  /**
   * Cancel a booking (must be owned by the current user, show not yet started)
   * @param {string} id
   * @param {string} [reason]
   */
  cancelBooking: (id, reason = '') =>
    apiRequest(`/bookings/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: { reason },
    }),

  /**
   * Create Razorpay payment order for booking
   * @param {string} id
   */
  createPaymentOrder: (id) =>
    apiRequest(`/bookings/${encodeURIComponent(id)}/payment/create-order`, { method: 'POST' }),

  /**
   * Verify Razorpay payment signature on backend
   * @param {string} id
   * @param {Object} paymentData - { razorpay_order_id, razorpay_payment_id, razorpay_signature }
   */
  verifyPayment: (id, paymentData) =>
    apiRequest(`/bookings/${encodeURIComponent(id)}/payment/verify`, {
      method: 'POST',
      body: paymentData,
    }),
};
