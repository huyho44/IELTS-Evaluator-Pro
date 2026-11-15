import { AdminHeaderSection } from "./AdminHeaderSection";
import { AdminNavigationSection } from "./AdminNavigationSection";
import { InstructorApprovalsSection } from "./InstructorApprovalsSection";

export const ElementAdminDuytGio = (): JSX.Element => {
  return (
    <div className="relative min-h-[900px] w-full min-w-[1440px] bg-[#f8f7fb]">
      <AdminHeaderSection />
      <AdminNavigationSection />
      <main aria-label="Instructor approvals">
        <InstructorApprovalsSection />
      </main>
    </div>
  );
};
