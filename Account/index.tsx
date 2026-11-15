import { AccountManagementSection } from "./AccountManagementSection";
import { AdminHeaderSection } from "./AdminHeaderSection";
import { AdminNavigationSection } from "./AdminNavigationSection";

export const ElementAdminTiKhonFe = (): JSX.Element => {
  return (
    <main
      className="bg-[#f8f7fb] w-full min-w-[1440px] min-h-[981px] relative"
      aria-label="Admin account management"
    >
      <AccountManagementSection />
      <AdminHeaderSection />
      <AdminNavigationSection />
    </main>
  );
};