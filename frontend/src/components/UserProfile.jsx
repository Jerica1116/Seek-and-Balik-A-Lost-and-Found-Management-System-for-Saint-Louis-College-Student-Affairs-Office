import React, { useEffect, useState } from 'react';
import {
  User,
  KeyRound,
  Pencil,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  LogOut,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getProfile, updateProfile, changePassword } from '../api/api';

/**
 * ─── UserProfile ────────────────────────────────────────────────────────
 * Self-service profile page for the logged-in staff user.
 *
 *   1. Profile details — first/last name, email, and an editable "Alias
 *      Name" (a display name shown instead of the real name wherever the
 *      app surfaces the acting user, e.g. activity logs).
 *   2. Change Password — inline (expands in place, same pattern as
 *      "Edit Profile" below) rather than a separate modal component. It
 *      keeps the same two-step flow the old ChangePasswordModal used
 *      (form -> "are you sure?" -> submit), the same validation rules
 *      (12-16 chars, no spaces, match check), and the same
 *      changePassword(currentPassword, newPassword) API call — just
 *      rendered as a card section instead of an overlay.
 *   3. Log Out — a dedicated section at the bottom of the page so staff
 *      have a clear, deliberate way to end their session from a page
 *      they already associate with account-level actions. Two-step
 *      (button -> "are you sure?") to avoid an accidental single-click
 *      sign-out, matching the confirm pattern already used for password
 *      changes on this page.
 *
 * Expects three functions exported from ../api/api:
 *   - getProfile()                          -> GET  current user's profile
 *   - updateProfile(payload)                -> PATCH/PUT profile fields (incl. alias_name)
 *   - changePassword(current, next)         -> POST change password
 *
 * ASSUMPTION: AppContext's useApp() exposes a `logout` function (clearing
 * the stored auth token/session and resetting currentUser). If it doesn't
 * yet, add one there — see handleLogoutConfirm below for the fallback
 * this uses in the meantime (clearing currentUser via setCurrentUser and
 * the common localStorage auth-token keys directly) so this still works
 * without that change.
 */

const EMPTY_PROFILE = {
  first_name: '',
  last_name: '',
  alias_name: '',
  email: '',
};

const EMPTY_PASSWORD_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const inputClass =
  "h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1478a7] disabled:bg-slate-100 disabled:text-slate-500";
const labelClass = "mb-2 block text-xs font-bold uppercase text-slate-700";

// Small inline banner used for profile feedback, so the section doesn't
// need a window.alert() popup for routine confirmation.
const Banner = ({ tone, message, onDismiss }) => {
  if (!message) return null;
  const isSuccess = tone === 'success';
  return (
    <div
      className={`mb-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-600'
      }`}
    >
      {isSuccess ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
};

// Same show/hide password field used by the old ChangePasswordModal, kept
// visually consistent with this page's slate/rounded input style.
const PasswordField = ({ label, name, value, onChange, show, toggleShow, disabled }) => (
  <div>
    <label className={labelClass}>{label}</label>
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`${inputClass} pr-11`}
      />
      <button
        type="button"
        onClick={toggleShow}
        disabled={disabled}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:opacity-40"
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  </div>
);

// Initials badge shown in the header card in place of a static icon —
// falls back to the User icon when there isn't enough of a name yet to
// derive initials from.
const InitialsAvatar = ({ firstName, lastName }) => {
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-base font-black tracking-wide text-white ring-2 ring-white/25 sm:h-14 sm:w-14 sm:text-lg">
      {initials || <User size={24} />}
    </div>
  );
};

const UserProfile = () => {
  const { currentUser, setCurrentUser, logout } = useApp();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [editMode, setEditMode] = useState(false);
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileBanner, setProfileBanner] = useState(null); // { tone, message }

  // Inline change-password section state (replaces the old modal).
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordConfirmStep, setPasswordConfirmStep] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Inline log-out section state — same two-step "click -> confirm"
  // pattern as password change above, kept in its own card at the
  // bottom of the page.
  const [logoutConfirmStep, setLogoutConfirmStep] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    setLoading(true);
    try {
      const data = await getProfile();
      const normalized = { ...EMPTY_PROFILE, ...data };
      setProfile(normalized);
      setProfileForm(normalized);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfileBanner({ tone: 'error', message: 'Could not load your profile. Try refreshing the page.' });
    } finally {
      setLoading(false);
    }
  }

  const setField = (key, value) => setProfileForm((prev) => ({ ...prev, [key]: value }));

  const startEdit = () => {
    setProfileForm(profile);
    setProfileBanner(null);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setProfileForm(profile);
    setEditMode(false);
    setProfileBanner(null);
  };

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (savingProfile) return;

    if (!profileForm.first_name?.trim()) {
      setProfileBanner({ tone: 'error', message: 'First name is required.' });
      return;
    }
    if (!profileForm.last_name?.trim()) {
      setProfileBanner({ tone: 'error', message: 'Last name is required.' });
      return;
    }
    // Alias is optional, but if provided, keep it to a sane length so it
    // reads well anywhere it's substituted for the real name.
    if (profileForm.alias_name && profileForm.alias_name.trim().length > 40) {
      setProfileBanner({ tone: 'error', message: 'Alias name must be 40 characters or fewer.' });
      return;
    }

    setSavingProfile(true);
    setProfileBanner(null);
    try {
      const payload = {
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
        alias_name: profileForm.alias_name?.trim() || '',
      };
      const updated = await updateProfile(payload);
      const normalized = { ...profile, ...profileForm, ...updated };
      setProfile(normalized);
      setProfileForm(normalized);
      setEditMode(false);
      setProfileBanner({ tone: 'success', message: 'Profile updated successfully.' });
    } catch (error) {
      console.error('Error updating profile:', error);
      const msg = error.response?.data?.detail || 'Failed to update profile. Please try again.';
      setProfileBanner({ tone: 'error', message: msg });
    } finally {
      setSavingProfile(false);
    }
  }

  // ── Change password (inline) ──────────────────────────────────────

  const openPasswordSection = () => {
    setPasswordForm(EMPTY_PASSWORD_FORM);
    setPasswordError('');
    setPasswordConfirmStep(false);
    setShowPasswordSection(true);
  };

  const closePasswordSection = () => {
    setShowPasswordSection(false);
    setPasswordConfirmStep(false);
    setPasswordForm(EMPTY_PASSWORD_FORM);
    setPasswordError('');
  };

  const handlePasswordFieldChange = (e) => {
    setPasswordForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setPasswordError('');
  };

  // Step 1 -> validate, then advance to the "are you sure?" step. Same
  // constraints the backend enforces, checked client-side first so the
  // confirmation step is only reached with a submission that can succeed.
  const handlePasswordFormSubmit = (e) => {
    e.preventDefault();
    setPasswordError('');

    if (passwordForm.newPassword.length < 12 || passwordForm.newPassword.length > 16) {
      setPasswordError('Password must be 12 to 16 characters long.');
      return;
    }
    if (/\s/.test(passwordForm.newPassword)) {
      setPasswordError('Password must not contain spaces.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match!');
      return;
    }

    setPasswordConfirmStep(true);
  };

  // Step 2 -> user confirmed. Submit, then redirect to login the same
  // way the old modal's onSuccess did, since the backend invalidates the
  // current session's password and the user needs to sign back in.
  const handlePasswordConfirm = async () => {
    setChangingPassword(true);
    setPasswordError('');
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      window.location.href = '/login';
    } catch (error) {
      const apiError =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to change password.';
      setPasswordError(apiError);
      setPasswordConfirmStep(false);
    } finally {
      setChangingPassword(false);
    }
  };

  // ── Log out (inline) ──────────────────────────────────────────────

  const openLogoutConfirm = () => setLogoutConfirmStep(true);
  const cancelLogout = () => setLogoutConfirmStep(false);

  async function handleLogoutConfirm() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      // Prefer a context-provided logout() if AppContext exposes one —
      // it's the right place for clearing whatever auth token/session
      // storage the rest of the app relies on. See the ASSUMPTION note
      // at the top of this file.
      if (typeof logout === 'function') {
        await logout();
      } else {
        // Fallback: clear the common localStorage auth-token key names
        // directly and reset the in-memory current user, so signing out
        // still works even before AppContext grows a dedicated logout().
        ['token', 'authToken', 'access_token', 'accessToken'].forEach((key) =>
          localStorage.removeItem(key)
        );
        setCurrentUser?.(null);
      }
    } catch (error) {
      console.error('Error logging out:', error);
      // Even if a server-side logout call fails, still clear local state
      // and send the user to the login page — staying "logged in" on a
      // failed logout is worse than a redundant login prompt.
    } finally {
      window.location.href = '/login';
    }
  }

  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Your Profile';

  return (
    <div className="mx-auto flex h-[calc(100vh-135px)] w-full max-w-3xl flex-col gap-4 overflow-y-auto px-3 pb-6 sm:gap-5 sm:px-0">

      {/* Header card */}
      <div className="overflow-hidden rounded-[18px] border border-[#D8E2EF] bg-white shadow-[0_8px_24px_rgba(45,54,109,0.08)]">
        <div className="flex items-center gap-3 bg-gradient-to-r from-[#0B648D] to-[#155F87] px-4 py-4 text-white sm:gap-4 sm:px-6 sm:py-5">
          <InitialsAvatar firstName={profile.first_name} lastName={profile.last_name} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold sm:text-lg">{displayName}</h3>
            <p className="mt-0.5 truncate text-xs text-white/90 sm:text-sm">
              {profile.alias_name ? `Also known as "${profile.alias_name}"` : 'No alias set yet'}
            </p>
          </div>

          {/* Quick logout access from the header too, for a one-click
              path once staff already trust the confirm step below —
              routes to the same confirm flow rather than logging out
              immediately. */}
          <button
            type="button"
            onClick={openLogoutConfirm}
            title="Log Out"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-white/25"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </div>

      {/* Profile details */}
      <div className="rounded-[18px] border border-[#D8E2EF] bg-white p-4 shadow-[0_8px_24px_rgba(45,54,109,0.08)] sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-sm font-black uppercase tracking-[0.12em] text-[#071E3D]">Profile Details</h4>
            <p className="mt-0.5 text-xs italic text-[#7B8AA6]">Your name and alias, shown across the app</p>
          </div>
          {!editMode && (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-[#2D366D] px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-[0_6px_14px_rgba(45,54,109,0.25)] transition-all hover:bg-[#24305C] sm:self-auto"
            >
              <Pencil size={14} /> Edit Profile
            </button>
          )}
        </div>

        <Banner tone={profileBanner?.tone} message={profileBanner?.message} onDismiss={() => setProfileBanner(null)} />

        {loading ? (
          <p className="py-6 text-center text-sm font-medium text-[#7B8AA6]">Loading profile…</p>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>First Name *</label>
                <input
                  className={inputClass}
                  value={profileForm.first_name || ''}
                  onChange={(e) => setField('first_name', e.target.value)}
                  disabled={!editMode}
                  placeholder="First name"
                />
              </div>
              <div>
                <label className={labelClass}>Last Name *</label>
                <input
                  className={inputClass}
                  value={profileForm.last_name || ''}
                  onChange={(e) => setField('last_name', e.target.value)}
                  disabled={!editMode}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <input
                className={inputClass}
                value={profileForm.email || ''}
                disabled
                placeholder="you@example.com"
              />
              <p className="mt-1 text-xs font-medium text-slate-400">
                Email can't be changed here — contact an administrator if this needs to update.
              </p>
            </div>

            <div>
              <label className={labelClass}>Alias Name</label>
              <input
                className={inputClass}
                value={profileForm.alias_name || ''}
                onChange={(e) => setField('alias_name', e.target.value)}
                disabled={!editMode}
                placeholder="e.g. Front Desk Staff, JD"
                maxLength={40}
              />
              <p className="mt-1 text-xs font-medium text-slate-400">
                Optional. Shown in place of your real name wherever the app displays who performed an action.
              </p>
            </div>

            {editMode && (
              <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#384388] to-[#2D366D] py-3 text-sm font-semibold uppercase tracking-wide text-white hover:shadow-lg active:scale-[0.98] disabled:opacity-60"
                >
                  <Save size={15} /> {savingProfile ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="h-12 rounded-xl bg-slate-200 text-sm font-black uppercase text-slate-500 hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      {/* Change password — inline section, expands in place */}
      <div className="rounded-[18px] border border-[#D8E2EF] bg-white p-4 shadow-[0_8px_24px_rgba(45,54,109,0.08)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="shrink-0 text-[#0B6B8A]" />
            <div className="min-w-0">
              <h4 className="text-sm font-black uppercase tracking-[0.12em] text-[#071E3D]">Password</h4>
              <p className="mt-0.5 text-xs italic text-[#7B8AA6]">
                Update your account password (12–16 characters, no spaces)
              </p>
            </div>
          </div>

          {!showPasswordSection && (
            <button
              type="button"
              onClick={openPasswordSection}
              className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full bg-[#0B6B8A] px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-md transition hover:bg-[#095A74] active:scale-[0.98] sm:self-auto"
            >
              <KeyRound size={14} /> Change Password
            </button>
          )}
        </div>

        {showPasswordSection && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            {passwordError && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span className="flex-1">{passwordError}</span>
              </div>
            )}

            {passwordConfirmStep ? (
              // Step 2: "are you sure?" — same as the old modal's second step
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <AlertTriangle size={22} />
                </div>
                <h5 className="text-base font-bold text-slate-800">
                  Are you sure you want to change your password?
                </h5>
                <p className="text-xs text-slate-500">
                  You'll be redirected to the login page to sign back in with your new password.
                </p>
                <div className="flex flex-col items-center justify-center gap-3 pt-1 sm:flex-row">
                  <button
                    type="button"
                    disabled={changingPassword}
                    onClick={() => setPasswordConfirmStep(false)}
                    className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 sm:w-1/2"
                  >
                    No, Keep Old
                  </button>
                  <button
                    type="button"
                    disabled={changingPassword}
                    onClick={handlePasswordConfirm}
                    className="w-full rounded-xl bg-[#0B648D] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#094f70] disabled:opacity-50 sm:w-1/2"
                  >
                    {changingPassword ? 'Saving…' : 'Yes, Change'}
                  </button>
                </div>
              </div>
            ) : (
              // Step 1: password form
              <form onSubmit={handlePasswordFormSubmit} className="space-y-3">
                <PasswordField
                  label="Current Password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordFieldChange}
                  show={showCurrent}
                  toggleShow={() => setShowCurrent((v) => !v)}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <PasswordField
                    label="New Password (12–16 chars)"
                    name="newPassword"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordFieldChange}
                    show={showNew}
                    toggleShow={() => setShowNew((v) => !v)}
                  />
                  <PasswordField
                    label="Confirm New Password"
                    name="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordFieldChange}
                    show={showConfirm}
                    toggleShow={() => setShowConfirm((v) => !v)}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#0B6B8A] to-[#095A74] py-3 text-sm font-semibold uppercase tracking-wide text-white hover:shadow-lg active:scale-[0.98]"
                  >
                    <KeyRound size={15} /> Continue
                  </button>
                  <button
                    type="button"
                    onClick={closePasswordSection}
                    className="h-12 rounded-xl bg-slate-200 text-sm font-black uppercase text-slate-500 hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Log out — dedicated section, two-step confirm like Password
          above. The header button (top-right of the header card) opens
          this same confirm step rather than logging out immediately. */}
      <div className="rounded-[18px] border border-[#D8E2EF] bg-white p-4 shadow-[0_8px_24px_rgba(45,54,109,0.08)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <LogOut size={18} className="shrink-0 text-red-500" />
            <div className="min-w-0">
              <h4 className="text-sm font-black uppercase tracking-[0.12em] text-[#071E3D]">Session</h4>
              <p className="mt-0.5 text-xs italic text-[#7B8AA6]">
                Sign out of your account on this device
              </p>
            </div>
          </div>

          {!logoutConfirmStep && (
            <button
              type="button"
              onClick={openLogoutConfirm}
              className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-red-600 shadow-sm transition hover:bg-red-100 active:scale-[0.98] sm:self-auto"
            >
              <LogOut size={14} /> Log Out
            </button>
          )}
        </div>

        {logoutConfirmStep && (
          <div className="mt-5 space-y-4 border-t border-slate-100 pt-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle size={22} />
            </div>
            <h5 className="text-base font-bold text-slate-800">Log out of your account?</h5>
            <p className="text-xs text-slate-500">
              You'll need to sign back in to access the dashboard again.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 pt-1 sm:flex-row">
              <button
                type="button"
                disabled={loggingOut}
                onClick={cancelLogout}
                className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 sm:w-1/2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loggingOut}
                onClick={handleLogoutConfirm}
                className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50 sm:w-1/2"
              >
                {loggingOut ? 'Logging out…' : 'Yes, Log Out'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
