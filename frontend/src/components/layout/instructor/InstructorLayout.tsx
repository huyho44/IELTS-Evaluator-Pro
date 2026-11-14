// src/components/layout/instructor/InstructorLayout.tsx
import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useSession } from "../../../features/auth/session";
import InstructorHeader from "./InstructorHeader";
import InstructorSidebar from "./InstructorSidebar";
import { resolveActiveInstructorKey } from "./instructorNav";

export default function InstructorLayout() {
  const { session } = useSession();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!session) return null;
  const activeKey = resolveActiveInstructorKey(location.pathname);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex">
        <InstructorSidebar
          activeKey={activeKey}
          roles={session.user.roles}
        />
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 flex">
            <InstructorSidebar
              activeKey={activeKey}
              roles={session.user.roles}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <InstructorHeader
          activeKey={activeKey}
          user={session.user}
          mobileMenuOpen={mobileOpen}
          onOpenMobileMenu={() => setMobileOpen((prev) => !prev)}
        />
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}