import React, { useState } from "react";
import { registerUser } from "../api/api";
import { useNavigate } from "react-router-dom";
import slcLogo from "../assets/slc-logo.png";
import saoLogo from "../assets/sao.png";

// School ID email rule: 1–8 digits only, followed by @slc-sflu.edu.ph
// e.g. 23100094@slc-sflu.edu.ph
const SCHOOL_EMAIL_REGEX = /^\d{1,8}@slc-sflu\.edu\.ph$/i;

const RegisterModal = ({ onClose, onSwitchToLogin }) => {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  const [emailError, setEmailError] = useState("");
  const [contactError, setContactError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const validateSchoolEmail = (value) => {
    if (!value.trim()) {
      return "School ID email is required.";
    }
    if (!SCHOOL_EMAIL_REGEX.test(value.trim())) {
      return "Use your School ID email, e.g. 23100094@slc-sflu.edu.ph (numbers only, max 8 digits).";
    }
    return "";
  };

  // Optional field — only validated if the person actually typed something.
  const validateContactNumber = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (!/^[0-9+\-\s]{7,15}$/.test(trimmed)) {
      return "Enter a valid contact number (digits only, 7–15 characters).";
    }
    return "";
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setSchoolEmail(value);
    if (emailError) {
      setEmailError(validateSchoolEmail(value));
    }
  };

  const handleEmailBlur = (e) => {
    setEmailError(validateSchoolEmail(e.target.value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = schoolEmail.trim();
    const trimmedContact = contactNumber.trim();

    const emailValidationError = validateSchoolEmail(trimmedEmail);
    if (emailValidationError) {
      setEmailError(emailValidationError);
      return;
    }

    const contactValidationError = validateContactNumber(trimmedContact);
    if (contactValidationError) {
      setContactError(contactValidationError);
      return;
    }

    if (!trimmedFirst || !trimmedLast) {
      setError("Please enter your first and last name.");
      return;
    }

    setLoading(true);

    try {
      // No password is collected here — the backend auto-generates one,
      // marks the account as must_change_password, and emails the
      // temporary password to the school-ID address. The account is
      // always created with the "student" role.
      await registerUser({
        first_name: trimmedFirst,
        last_name: trimmedLast,
        email: trimmedEmail,
        contact_number: trimmedContact || undefined,
      });

      setSuccess(
        "Account created! We've emailed a temporary password to your school ID address. Use it to log in below."
      );

      setFirstName("");
      setLastName("");
      setSchoolEmail("");
      setContactNumber("");

      // Give the person a moment to read the success message, then send
      // them to login instead of trying to auto-login (we don't — and
      // shouldn't — know the generated password on the frontend).
      setTimeout(() => {
        goToLogin();
      }, 2000);
    } catch (err) {
      console.error(err);

      // DRF returns validation errors as { field: ["msg", ...] }, not a
      // single "message" string — so pull the first field error out if
      // present, and only fall back to the generic line if we truly can't
      // find anything useful in the response.
      const data = err?.response?.data;
      let serverMessage = data?.message || data?.error || data?.detail;

      if (!serverMessage && data && typeof data === "object") {
        const firstKey = Object.keys(data)[0];
        const firstVal = data[firstKey];
        if (firstKey) {
          serverMessage = Array.isArray(firstVal) ? firstVal[0] : firstVal;
          // Prefix with the field name unless it's the generic email field,
          // which already reads fine on its own.
          if (firstKey !== "email" && serverMessage) {
            serverMessage = `${firstKey}: ${serverMessage}`;
          }
        }
      }

      setError(
        serverMessage ||
          "Unable to create your account. Please check your details and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    if (onSwitchToLogin) {
      onSwitchToLogin();
    } else {
      navigate("/login");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-md p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading && onClose) onClose();
      }}
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_rgba(0,0,0,.25)] max-h-[90vh] overflow-y-auto">
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
                <h2 className="text-xl font-bold text-[#154B70]">Create Account</h2>
                <p className="text-gray-500 mt-1 text-sm">Register using your SLC school ID.</p>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#154B70]">First Name</label>
                  <input
                    name="firstName"
                    type="text"
                    required
                    disabled={loading}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Juan"
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:border-[#0B648D] focus:ring-4 focus:ring-[#0B648D]/20 outline-none transition disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#154B70]">Last Name</label>
                  <input
                    name="lastName"
                    type="text"
                    required
                    disabled={loading}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dela Cruz"
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:border-[#0B648D] focus:ring-4 focus:ring-[#0B648D]/20 outline-none transition disabled:bg-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#154B70]">School ID Email</label>
                <input
                  name="schoolEmail"
                  type="email"
                  required
                  disabled={loading}
                  value={schoolEmail}
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  placeholder="e.g. 23100094@slc-sflu.edu.ph"
                  pattern="^\d{1,8}@slc-sflu\.edu\.ph$"
                  title="Use your School ID email, e.g. 23100094@slc-sflu.edu.ph"
                  className={`mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition disabled:bg-gray-100 focus:ring-4 ${
                    emailError
                      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                      : "border-gray-300 focus:border-[#0B648D] focus:ring-[#0B648D]/20"
                  }`}
                />
                {emailError ? (
                  <p className="mt-1 text-[11px] text-red-500">{emailError}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Numbers only, max 8 digits, e.g. 23100094@slc-sflu.edu.ph
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-[#154B70]">
                  Contact Number <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  name="contactNumber"
                  type="tel"
                  disabled={loading}
                  value={contactNumber}
                  onChange={(e) => {
                    const value = e.target.value;
                    setContactNumber(value);
                    if (contactError) setContactError(validateContactNumber(value));
                  }}
                  onBlur={(e) => setContactError(validateContactNumber(e.target.value))}
                  placeholder="e.g. 09123456789"
                  className={`mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition disabled:bg-gray-100 focus:ring-4 ${
                    contactError
                      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                      : "border-gray-300 focus:border-[#0B648D] focus:ring-[#0B648D]/20"
                  }`}
                />
                {contactError && (
                  <p className="mt-1 text-[11px] text-red-500">{contactError}</p>
                )}
              </div>

              <p className="text-[11px] text-slate-400 -mt-1">
                A temporary password will be emailed to your school ID address after you register.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-xl bg-[#0B648D] py-2.5 text-sm font-semibold text-white transition hover:bg-[#094f70] active:scale-[.98] disabled:bg-slate-400 disabled:cursor-not-allowed shadow-md"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Creating Account & Sending Email...
                  </span>
                ) : (
                  "REGISTER"
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
                <p className="text-xs text-slate-500">Already have an account?</p>

                <button
                  type="button"
                  onClick={goToLogin}
                  className="mt-1.5 text-[#005B82] hover:text-[#004766] font-bold text-xs transition"
                >
                  Login Here
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterModal;