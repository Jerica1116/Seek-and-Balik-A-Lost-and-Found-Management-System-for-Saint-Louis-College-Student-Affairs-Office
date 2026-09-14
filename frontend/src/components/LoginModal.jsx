import React, { useState } from "react";
import { loginUser, getCurrentUser } from "../api/api";
import { useApp } from "../context/AppContext";
import { useNavigate } from "react-router-dom";
import slcLogo from "../assets/slc-logo.png";
import saoLogo from "../assets/sao.png";
import ChangePasswordModal from "./ChangePasswordModal";
import RegisterModal from "./RegisterModal";

const LoginModal = ({ onClose }) => {
  const { setLogin } = useApp();
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const username = e.target.username.value.trim();
    const password = e.target.password.value.trim();

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // 1. Authenticate with server & receive tokens
      await loginUser(username, password);

      // 2. Retrieve user object
      const userProfile = await getCurrentUser();

      // Check for mandatory password reset flag
      if (userProfile.must_change_password) {
        setPendingUser(userProfile);
        setMustChangePassword(true);
        return;
      }

      // The single-current-admin swap already happened server-side, at
      // creation/promotion time (see _deactivate_other_admins in
      // views.py). There is nothing admin-related to do here on login —
      // is_active is never used for the handover and is_current_admin is
      // already correct on this profile by the time we get here.
      setLogin(userProfile);

      // Staff (admin/moderator) go to the dashboard. Self-registered
      // school-ID accounts ("student" role) only ever get the landing page.
      const destination =
        userProfile.role === "admin" || userProfile.role === "moderator"
          ? "/dashboard"
          : "/";

      navigate(destination, { replace: true });
      if (onClose) onClose();
    } catch (err) {
      console.error(err);
      // The backend currently returns the same generic error for wrong
      // credentials AND a deactivated/inactive account, so we can't tell
      // these apart for certain here.
      setError(
        "Invalid credentials, or this account may be inactive. Please double-check your details, or contact your system administrator if you believe this account was deactivated."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
  <>
    {showRegister ? (
      
      <RegisterModal
        onClose={onClose}
        onSwitchToLogin={() => setShowRegister(false)}
      />

    ) : (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-md p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading && !mustChangePassword && onClose) onClose();
      }}
    >
      {mustChangePassword && (
        <ChangePasswordModal
          mustChangePassword={pendingUser?.must_change_password}
          onSuccess={() => {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");

            setMustChangePassword(false);
            setPendingUser(null);
            setSuccess("Password changed successfully. Please log in using your new password.");
          }}
          onCancel={() => {
            setMustChangePassword(false);
            setPendingUser(null);
          }}
        />
      )}

      <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_rgba(0,0,0,.25)]">
        <div className="grid md:grid-cols-2">
          {/* BRANDING PANEL */}
          <div className="bg-gradient-to-br from-[#0B648D] to-[#155F87] text-white p-8 flex flex-col justify-center">
            <div className="flex justify-center gap-3 mb-5">
              <img
                src={slcLogo}
                alt="SLC Logo"
                className="w-12 h-12 object-contain bg-white rounded-full p-1 shadow-md"
              />
              <img
                src={saoLogo}
                alt="Seek & Balik Logo"
                className="w-12 h-12 object-contain bg-white rounded-full p-1 shadow-md"
              />
            </div>

            <h1 className="text-3xl font-serif leading-tight">Saint Louis College</h1>
            <p className="italic text-blue-100 mt-2 text-sm">City of San Fernando, La Union</p>
            <div className="w-full h-[2px] bg-white/40 my-5"></div>
            <h2 className="text-xl font-black tracking-widest">SEEK & BALIK</h2>
            <p className="text-blue-100 mt-2 text-sm">Lost and Found Management System</p>
          </div>

          {/* FORM PANEL */}
          <div className="p-8 flex flex-col justify-center">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-xl font-bold text-[#154B70]">Welcome Back</h2>
                <p className="text-gray-500 mt-1 text-sm">Log in to your account.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 font-medium">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 font-medium">
                  {success}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-[#154B70]">Email Address</label>
                <input
                  name="username"
                  type="email"
                  required
                  disabled={loading}
                  placeholder="Enter your email"
                  className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:border-[#0B648D] focus:ring-4 focus:ring-[#0B648D]/20 outline-none transition disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#154B70]">Password</label>
                <input
                  name="password"
                  type="password"
                  required
                  disabled={loading}
                  placeholder="Enter your password"
                  className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:border-[#0B648D] focus:ring-4 focus:ring-[#0B648D]/20 outline-none transition disabled:bg-gray-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-xl bg-[#0B648D] py-2.5 text-sm font-semibold text-white transition hover:bg-[#094f70] active:scale-[.98] disabled:bg-slate-400 disabled:cursor-not-allowed shadow-md"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Authenticating...
                  </span>
                ) : (
                  "LOGIN"
                )}
              </button>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="w-full rounded-xl border border-[#0B648D] py-2.5 text-sm font-medium text-[#0B648D] transition hover:bg-blue-50 disabled:opacity-50"
                >
                  CANCEL
                </button>
              )}

              <div className="text-center pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  Don't have an account?
                </p>

                <button
                  type="button"
                  onClick={() => setShowRegister(true)}
                  className="mt-1.5 text-[#005B82] hover:text-[#004766] font-bold text-xs transition"
                >
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
        )}
  </>
  );
};

export default LoginModal;