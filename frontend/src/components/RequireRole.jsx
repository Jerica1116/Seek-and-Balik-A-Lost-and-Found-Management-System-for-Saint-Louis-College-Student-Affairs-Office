import React from "react";
import { useApp } from "../context/AppContext";
import { Navigate } from "react-router-dom";

// `redirectTo` is where a logged-in-but-wrong-role user gets bounced.
// Defaults to "/dashboard" for sub-route guards (e.g. an admin hitting a
// moderator-only page just gets sent back to the dashboard home). Pass
// redirectTo="/" when wrapping the dashboard root itself, otherwise a
// student account would bounce in a loop between "/dashboard" and itself.
const RequireRole = ({ allowedRoles = [], redirectTo = "/dashboard", children }) => {
  const { isLoggedIn, userRole } = useApp();

  // not logged in
  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  // role check
  if (!allowedRoles.includes(userRole)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

export default RequireRole;