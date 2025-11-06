import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Mail, Send } from "lucide-react";

const InviteAdmin = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { sendInvite, login, token } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    // Ensure super admin is authenticated
    if (!token) {
      setShowAuthModal(true);
      setLoading(false);
      return;
    }

    const result = await sendInvite(email);

    if (result.success) {
      setMessage(result.message);
      setEmail("");
      // Navigate to signup after successful invitation
      setTimeout(() => {
        navigate("/signup");
      }, 2000);
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Main Card */}
        <div className="bg-white p-8 rounded-xl shadow-lg border">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-secondary" />
            </div>
            <h2 className="text-3xl font-extrabold text-primary">
              Invite New Admin
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Send an invitation code to a new admin
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  placeholder="Enter admin email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Status Messages */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {message && (
              <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-md">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-green-700">{message}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-secondary bg-primary hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary mr-2"></div>
                    Sending invitation...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Send className="h-4 w-4 mr-2" />
                    Send Invitation
                  </div>
                )}
              </button>
            </div>

            {/* Footer */}
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{" "}
                <button
                  onClick={() => navigate("/login")}
                  className="font-medium text-primary hover:text-opacity-80 transition-colors"
                >
                  Sign in here
                </button>
              </p>
            </div>
          </form>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-white p-4 rounded-lg shadow border">
          <div className="text-center">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              How it works
            </h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p>1. Enter the admin's email address</p>
              <p>2. They'll receive an invitation code via email</p>
              <p>3. They can use the code to sign up at /signup</p>
            </div>
          </div>
        </div>
      </div>

      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3 text-primary">Super Admin Login</h3>
            <p className="text-sm text-gray-600 mb-3">Enter super admin credentials to send an invite.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border p-2 rounded"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="superadmin@email.com"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Password</label>
                <input
                  type="password"
                  className="w-full border p-2 rounded"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAuthModal(false)} className="px-4 py-2 border rounded">Cancel</button>
              <button
                onClick={async () => {
                  setLoading(true);
                  setError("");
                  const res = await login(adminEmail, adminPassword);
                  if (!res.success) {
                    setError(res.message || 'Login failed');
                    setLoading(false);
                    return;
                  }
                  setShowAuthModal(false);
                  const result = await sendInvite(email);
                  if (result.success) {
                    setMessage(result.message);
                    setEmail("");
                    setTimeout(() => navigate("/signup"), 1500);
                  } else {
                    setError(result.message);
                  }
                  setLoading(false);
                }}
                className="bg-primary text-secondary px-4 py-2 rounded"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InviteAdmin;
