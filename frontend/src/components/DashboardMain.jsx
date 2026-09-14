import { Routes, Route } from "react-router-dom";

import DashboardHome from "../pages/Dashboard";
import LostItems from "../pages/LostItems";
import FoundItems from "../pages/FoundItems";
import Reports from "../pages/Reports";
import Users from "../pages/Users";
import ModeratorLostItems from "../pages/ModeratorLostItems";
import ActivityLogs from "../pages/ActivityLogs";

import RequireRole from "../components/RequireRole";

const DashboardMain = () => {
  return (
    <Routes>

      {/* COMMON (ADMIN + MODERATOR) */}
      <Route path="/" element={<DashboardHome />} />
      <Route path="lost-items" element={<LostItems />} />
      <Route path="surrendered-items" element={<FoundItems />} />
      <Route path="reports" element={<Reports />} />

      {/* MODERATOR ONLY */}
      <Route
        path="moderator-lost"
        element={
          <RequireRole allowedRoles={["moderator"]}>
            <ModeratorLostItems />
          </RequireRole>
        }
      />

      {/* ADMIN ONLY */}
      <Route
        path="users"
        element={
          <RequireRole allowedRoles={["admin"]}>
            <Users />
          </RequireRole>
        }
      />

      <Route
        path="activity-logs"
        element={
          <RequireRole allowedRoles={["admin"]}>
            <ActivityLogs />
          </RequireRole>
        }
      />

    </Routes>
  );
};

export default DashboardMain;
