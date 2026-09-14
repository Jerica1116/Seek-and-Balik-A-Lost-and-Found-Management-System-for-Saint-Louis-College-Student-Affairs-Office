import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import DashboardHome from "../pages/Dashboard";
import LostItems from "../pages/LostItems";
import FoundItems from "../pages/FoundItems";
import Reports from "../pages/Reports";
import Users from "../pages/Users";
import ModeratorLostItems from "../pages/ModeratorLostItems";
import ClaimRequests from "../pages/ClaimRequests";
import LeaderboardControl from "../pages/LeaderboardControl";
import ActivityLogs from "../pages/ActivityLogs";


import RequireRole from "../components/RequireRole";
import QuestionBank from "../components/QuestionBank";

const DashboardRoutes = () => {
  return (
    <Routes>
      {/* 1. Main Dashboard (/dashboard) */}
      <Route index element={<DashboardHome />} />

      {/* 2. Standard Items */}
      <Route path="lost-items" element={<LostItems />} />
      <Route path="surrendered-items" element={<FoundItems />} />
      <Route path="claim-requests" element={<ClaimRequests />} />
      <Route path="reports" element={<Reports />} />
      <Route path="leaderboard" element={<LeaderboardControl />} />

      {/* 3. Moderator Items */}
      <Route
        path="moderator-lost"
        element={
          <RequireRole allowedRoles={["moderator"]}>
            <ModeratorLostItems />
          </RequireRole>
        }
      />

      {/* 4. Admin Items */}
      <Route
        path="users"
        element={
          <RequireRole allowedRoles={["admin"]}>
            <Users />
          </RequireRole>
        }
      />

      {/* 5. Utilities */}
      <Route path="utilities/question-bank" element={<QuestionBank />} />
      <Route path="utilities/activity-logs" element={<ActivityLogs />} />
      <Route path="activity-logs" element={<ActivityLogs />} />

      {/* Fallback inside dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default DashboardRoutes;