import axios from "axios";

export const API_URL = "http://localhost:8000/";

const api = axios.create({
  baseURL: API_URL,
});

// Automatic JWT Token Interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ==========================================================
// 401 HANDLING WITH REAL TOKEN REFRESH
//
// The previous version of this interceptor deleted both tokens on a
// 401 and retried the SAME request with the Authorization header
// stripped entirely — which just guarantees a second 401 from any
// protected endpoint (e.g. claim/, the staff-only claims list). It
// never actually attempted a refresh, even though refreshToken was
// already being stored on login. Net effect: once an access token
// expired mid-session, every subsequent request (including
// ClaimRequests.jsx's 5s polling of getClaims()) failed silently
// forever, which looked exactly like "new claims aren't showing up" —
// the claims were fine server-side, the moderator's browser had just
// silently lost the ability to read them.
//
// This version calls the real SimpleJWT refresh endpoint once,
// queues any other requests that 401 while that refresh is in
// flight (so a burst of parallel calls doesn't trigger multiple
// refresh attempts), and retries each original request with the new
// access token. Only falls through to logging the user out if the
// refresh itself fails (i.e. the refresh token is also expired/invalid).
//
// ASSUMPTION: the refresh endpoint lives at "account/token/refresh/",
// matching the existing account/login/, account/register/,
// account/current/ naming pattern in this file. If your urls.py maps
// SimpleJWT's TokenRefreshView somewhere else (e.g. "token/refresh/"),
// update REFRESH_ENDPOINT below to match.
//
// FIX: two gaps in the original version of this interceptor:
//
// 1. A 401 from account/login/ itself (e.g. wrong password on the
//    login screen) used to fall into this same refresh flow and try
//    refreshing with whatever stale refreshToken happened to still be
//    sitting in localStorage from a previous session — completely
//    unrelated to the login attempt that just failed. Login/refresh
//    requests are now excluded from the refresh-and-retry logic
//    entirely; their 401s just reject normally and the login form
//    handles them as "invalid credentials".
//
// 2. When the refresh token was ALSO expired/invalid (a genuine "your
//    session is over" state), clearAuth() ran but nothing told the
//    rest of the app to stop acting like it was still logged in.
//    Pages that poll on an interval (ClaimRequests.jsx's 5s getClaims()
//    poll, Dashboard.jsx's fetchItems/fetchUsers/fetchClaims) kept
//    firing forever: no accessToken -> request goes out unauthenticated
//    -> 401 comes back -> interceptor finds no refreshToken -> rejects
//    immediately without even trying to refresh. That produced the
//    endless stream of bare 401s in the console with no further
//    refresh attempts. onAuthFailure() below now runs a single hard
//    redirect to /login whenever the session is truly over, which
//    unmounts every page (and every setInterval on it) instead of
//    leaving them to poll a dead session indefinitely.
// ==========================================================

const REFRESH_ENDPOINT = "account/token/refresh/";
const LOGIN_ENDPOINT = "account/login/";

let isRefreshing = false;
let refreshSubscribers = [];
// Guards against redirecting more than once if several requests hit a
// hard auth failure around the same time (e.g. a burst of polling
// calls all 401'ing together).
let redirectingToLogin = false;

const onRefreshed = (newToken) => {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
};

const clearAuth = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
};

// The session is genuinely over — clear tokens and send the user back
// to /login with a single full navigation. A full navigation (rather
// than a router push) guarantees every mounted page — and every
// setInterval/polling loop on it — is torn down, instead of quietly
// continuing to hit protected endpoints with no token.
const onAuthFailure = () => {
  clearAuth();
  if (redirectingToLogin) return;
  redirectingToLogin = true;

  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
};

const isAuthEndpoint = (url = "") =>
  url.includes(LOGIN_ENDPOINT) || url.includes(REFRESH_ENDPOINT);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt a refresh-and-retry once per request, and only for
    // actual 401s. Any other status (403, 500, etc.), a request that's
    // already been retried once, or the login/refresh endpoints
    // themselves (see FIX #1 above) just reject normally.
    if (
      !error.response ||
      error.response.status !== 401 ||
      originalRequest?.__retriedAfter401 ||
      isAuthEndpoint(originalRequest?.url)
    ) {
      return Promise.reject(error);
    }

    originalRequest.__retriedAfter401 = true;

    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      // Nothing to refresh with — this really is a "logged out" state.
      onAuthFailure();
      return Promise.reject(error);
    }

    // If a refresh is already in flight (e.g. several polling/parallel
    // requests 401'd around the same time), queue this request and
    // resolve it once that single refresh completes, instead of firing
    // a redundant refresh call per request.
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshSubscribers.push((newToken) => {
          if (!newToken) {
            reject(error);
            return;
          }
          originalRequest.headers = {
            ...originalRequest.headers,
            Authorization: `Bearer ${newToken}`,
          };
          resolve(api(originalRequest));
        });
      });
    }

    isRefreshing = true;

    try {
      // Plain axios (not the `api` instance) so this call never goes
      // through this same interceptor and never carries a stale
      // Authorization header.
      const res = await axios.post(`${API_URL}${REFRESH_ENDPOINT}`, {
        refresh: refreshToken,
      });

      const newAccessToken = res.data.access;
      localStorage.setItem("accessToken", newAccessToken);

      isRefreshing = false;
      onRefreshed(newAccessToken);

      originalRequest.headers = {
        ...originalRequest.headers,
        Authorization: `Bearer ${newAccessToken}`,
      };
      return api(originalRequest);
    } catch (refreshError) {
      isRefreshing = false;
      onRefreshed(null); // reject every queued request too
      // The refresh token is also expired/invalid — this is a genuine
      // "session is over" state, not a one-off network hiccup.
      onAuthFailure();
      return Promise.reject(refreshError);
    }
  }
);

// =====================
// CLAIMS
// =====================

export const createClaim = async (data) => {
  const res = await api.post("claim/create/", data);
  return res.data;
};

export const getClaims = async () => {
  const res = await api.get("claim/");
  return res.data;
};

export const scheduleMeeting = async (id, data) => {
  const res = await api.put(`claim/schedule/${id}/`, data);
  return res.data;
};

// =====================
// AVAILABLE SCHEDULES (NEW)
// =====================

export const getAvailableSchedules = async () => {
  const res = await api.get("claim/schedules/");
  return res.data;
};

export const createAvailableSchedule = async (scheduleData) => {
  const res = await api.post("claim/schedules/", scheduleData);
  return res.data;
};

export const deleteAvailableSchedule = async (id) => {
  const res = await api.delete(`claim/schedules/${id}/`);
  return res.data;
};

// =====================
// ITEMS
// =====================

export async function getItems() {
  const res = await api.get("item/details/");
  return res.data;
}

export async function createLostItem(formData) {
  const res = await api.post("item/create/", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
}

export async function editLostItem(id, data) {
  const res = await api.put(`item/details/${id}/`, data, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
}

export async function deleteLostItem(id) {
  const res = await api.delete(`item/details/${id}/`);
  return res.data;
}

export async function getItemById(id) {
  const res = await api.get(`item/details/${id}/`);
  return res.data;
}

export async function trackItem(ticketCode) {
  const res = await api.get(`item/track/${ticketCode}/`);
  return res.data;
}

// =====================
// AUTH
// =====================

import { logActivity } from '../utils/activityLog';

export { logActivity };

export async function loginUser(username, password) {
  const res = await api.post("account/login/", {
    username,
    password,
  });

  localStorage.setItem("accessToken", res.data.access);
  localStorage.setItem("refreshToken", res.data.refresh);
  // A fresh login means any previous "already redirecting to /login"
  // state no longer applies.
  redirectingToLogin = false;

  logActivity({
    actor_name: res.data.user?.username || username,
    actor_role: res.data.user?.role || 'User',
    action: 'login',
    target_title: res.data.user?.email || username,
    details: 'User logged into the system',
  });

  return res.data;
}

// Self-service registration (public "Create Account" form). Unlike
// createUser() below — which is used by an admin to create an account for
// someone else and is expected to be called while already authenticated —
// this is called from RegisterModal.jsx by an anonymous visitor. No tokens
// are stored here: the backend auto-generates a temporary password and
// emails it to the school ID address, so the frontend never sees a
// password to log in with. RegisterModal redirects to /login afterward.
export async function registerUser(data) {
  const res = await api.post("account/register/", data);

  logActivity({
    actor_name: `${data.first_name || ""} ${data.last_name || ""}`.trim() || data.email,
    actor_role: "student",
    action: "created",
    target_title: data.email,
    details: "Registered a new student account",
  });

  return res.data;
}

export async function getUsers() {
  const res = await api.get("account/users/");
  return res.data;
}

export async function getCurrentUser() {
  const res = await api.get("account/current/");
  return res.data;
}

export async function getUserById(id) {
  const res = await api.get(`account/users/${id}/`);
  return res.data;
}

// Self-service profile read/update for the currently logged-in user (used
// by UserProfile.jsx). Reuses the same "account/current/" endpoint as
// getCurrentUser() above, since that's already how this backend resolves
// "the logged-in user" from the JWT — no id needs to be passed in, unlike
// updateUserById() below which is the admin-editing-someone-else path.
// NOTE: confirm with your backend whether account/current/ accepts PATCH
// for partial updates — swap `.patch` to `.put` here if it only supports PUT.
export async function getProfile() {
  const res = await api.get("account/current/");
  return res.data;
}

export async function updateProfile(data) {
  const res = await api.patch("account/current/", data);

  logActivity({
    actor_name: `${res.data.first_name || ""} ${res.data.last_name || ""}`.trim() || res.data.username || "User",
    actor_role: res.data.role || "User",
    action: "updated",
    target_title: "Profile",
    details: "User updated their own profile details",
  });

  return res.data;
}

export async function updateUserById(id, data) {
  const res = await api.put(`account/users/${id}/`, data);

  logActivity({
    actor_name: res.data.updated_by || 'Admin',
    actor_role: 'Admin',
    action: 'updated',
    target_title: res.data.username || res.data.email || `User #${id}`,
    details: `Updated user account details`,
  });

  return res.data;
}

export async function deleteUserById(id) {
  const res = await api.delete(`account/users/${id}/`);
  return res.data;
}

export async function createUser(data) {
  const res = await api.post("account/users/", data);

  logActivity({
    actor_name: res.data.username || data.username || 'New User',
    actor_role: res.data.role || data.role || 'User',
    action: 'created',
    target_title: res.data.email || data.email || data.username,
    details: `Created a new account as ${res.data.role || data.role || 'User'}`,
  });

  return res.data;
}

export async function changePassword(current_password, new_password) {
  const res = await api.post("account/change-password/", {
    current_password,
    new_password,
  });

  logActivity({
    actor_name: 'User',
    actor_role: 'User',
    action: 'updated',
    target_title: 'Account Security',
    details: 'User updated their account password',
  });

  return res.data;
}

// =====================
// GAMIFICATION
// =====================

export const getLeaderboard = async () => {
  const res = await api.get("gamification/leaderboard/");
  return res.data;
};

export const getPointsTracking = async () => {
  const res = await api.get("gamification/points-tracking/");
  return res.data;
};

// Creates a new points-tracking record — e.g. +8 pts when a found item is
// surrendered. Posts to the same endpoint getPointsTracking() reads from,
// matching the list/create convention already used by claim/schedules/ and
// account/users/ above (same URL handles GET-list and POST-create). The
// `id_number` field is the unique identifier tying the record back to the
// student who should be credited — LeaderboardControl.jsx and its
// reasonLabel() already expect a `SURRENDER_ITEM` reason value here.
export const addPointsRecord = async (data) => {
  const res = await api.post("gamification/points-tracking/", data);
  return res.data;
};

export const getLeaderboardSettings = async () => {
  const res = await api.get("gamification/settings/");
  return res.data;
};

export const updateLeaderboardSettings = async (data) => {
  const res = await api.put("gamification/settings/update/", data);

  logActivity({
    actor_name: 'Admin',
    actor_role: 'Admin',
    action: 'updated',
    target_title: 'Gamification Settings',
    details: 'Updated leaderboard settings',
  });

  return res.data;
};

// Uses the shared `api` instance (not raw axios) so this goes through the
// same JWT interceptor as every other call here, and uses a relative path
// instead of manually prefixing API_URL. API_URL already ends in a slash
// ("http://localhost:8000/"), so the old `${API_URL}/claim/check/...`
// template produced a double slash ("http://localhost:8000//claim/check/..."),
// which some Django URL configs will fail to route (silent 404) instead of
// hitting the intended endpoint.
export const checkClaimStatus = async (itemId, email) => {
  const res = await api.get(`claim/check/${itemId}/`, {
    params: { email },
  });
  return res.data;
};