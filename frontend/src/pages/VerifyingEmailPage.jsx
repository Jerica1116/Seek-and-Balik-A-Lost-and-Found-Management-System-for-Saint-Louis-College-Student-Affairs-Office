import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { verifyOTP } from "../api/api";

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Email passed from RegisterPage
  const email = location.state?.email || "";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleVerify = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!email) {
      setError("No email address was provided. Please register again.");
      return;
    }

    if (!otp.trim()) {
      setError("Please enter your verification code.");
      return;
    }

    try {
      setLoading(true);

      const res = await verifyOTP({
        email: email,
        otp: otp.trim(),
      });

      setSuccess(
        res.message || "Account created successfully!"
      );

      // Give the user a moment to see the success message
      setTimeout(() => {
        navigate("/");
      }, 1500);

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Invalid verification code."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">

        {/* HEADER */}
        <div className="bg-[#0B648D] text-white p-8 text-center">
          <h1 className="text-3xl font-bold">
            Verify Your Email
          </h1>

          <p className="mt-2 text-blue-100">
            Seek & Balik Account Verification
          </p>
        </div>

        {/* CONTENT */}
        <form
          onSubmit={handleVerify}
          className="p-8 space-y-5"
        >

          {/* EMAIL */}
          <div className="text-center">
            <p className="text-sm text-slate-500">
              We sent a verification code to:
            </p>

            <p className="font-bold text-[#0B648D] mt-1 break-all">
              {email || "Unknown email"}
            </p>
          </div>

          {/* ERROR */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-600 p-3 text-sm">
              {error}
            </div>
          )}

          {/* SUCCESS */}
          {success && (
            <div className="rounded-xl bg-green-50 border border-green-200 text-green-700 p-3 text-sm">
              {success}
            </div>
          )}

          {/* OTP */}
          <div>
            <label className="block text-sm font-semibold text-[#154B70] mb-2">
              Verification Code
            </label>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) =>
                setOtp(
                  e.target.value.replace(/\D/g, "")
                )
              }
              placeholder="Enter 6-digit code"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-xl tracking-[0.4em] focus:border-[#0B648D] focus:ring-4 focus:ring-[#0B648D]/20 outline-none"
              disabled={loading}
            />
          </div>

          {/* VERIFY */}
          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full bg-[#0B648D] hover:bg-[#094f70] disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold transition"
          >
            {loading ? "Verifying..." : "Verify Account"}
          </button>

          {/* BACK */}
          <button
            type="button"
            onClick={() => navigate("/")}
            disabled={loading}
            className="w-full border border-[#0B648D] text-[#0B648D] py-3 rounded-xl font-semibold hover:bg-blue-50 transition disabled:opacity-50"
          >
            Back to Login
          </button>

        </form>
      </div>
    </div>
  );
}

