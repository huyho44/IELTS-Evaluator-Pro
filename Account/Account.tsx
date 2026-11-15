import { useState } from "react";
import vector from "./vector.svg";

type AccountStatus = "ACTIVE" | "SUSPENDED";
type Role = "LEARNER" | "INSTRUCTOR" | "ADMIN";

type Account = {
  name: string;
  email: string;
  roles: Role[];
  status: AccountStatus;
};

const accounts: Account[] = [
  {
    name: "Hoàn Hải",
    email: "student.an@ielts.example",
    roles: ["LEARNER"],
    status: "ACTIVE",
  },
  {
    name: "Nguyên Hưng",
    email: "teacher@ielts.example",
    roles: ["LEARNER", "INSTRUCTOR"],
    status: "ACTIVE",
  },
  {
    name: "Phạm Quang Huy",
    email: "admin@ielts.example",
    roles: ["ADMIN"],
    status: "ACTIVE",
  },
  {
    name: "Lê Thu Bình",
    email: "student.binh@ielts.example",
    roles: ["LEARNER"],
    status: "ACTIVE",
  },
  {
    name: "Trần Tuấn Phát",
    email: "phat@ielts.example",
    roles: ["INSTRUCTOR"],
    status: "ACTIVE",
  },
  {
    name: "Nguyễn Minh An",
    email: "minhan@ielts.example",
    roles: ["LEARNER"],
    status: "SUSPENDED",
  },
];

const roleStyles: Record<Role, string> = {
  LEARNER: "bg-slate-50 text-slate-500",
  INSTRUCTOR: "bg-indigo-50 text-indigo-800",
  ADMIN: "bg-violet-50 text-violet-700",
};

const statusStyles: Record<AccountStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  SUSPENDED: "bg-red-50 text-red-800",
};

const badgeClass =
  "inline-flex items-center justify-center gap-[var(--spacing-2xs)] pt-[var(--spacing-3xs)] pr-[var(--spacing-xs)] pb-[var(--spacing-3xs)] pl-[var(--spacing-xs)] rounded-[var(--border-radii-radius-full)]";

export const AccountManagementSection = (): JSX.Element => {
  const [selectedAccount, setSelectedAccount] = useState<Account>(accounts[1]);
  const [selectedStatus, setSelectedStatus] = useState<AccountStatus>(
    accounts[1].status,
  );
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(accounts[1].roles);
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState(false);

  const toggleRole = (role: Role) => {
    setSelectedRoles((currentRoles) =>
      currentRoles.includes(role)
        ? currentRoles.filter((currentRole) => currentRole !== role)
        : [...currentRoles, role],
    );
    setSaved(false);
  };

  const selectAccount = (account: Account) => {
    setSelectedAccount(account);
    setSelectedStatus(account.status);
    setSelectedRoles(account.roles);
    setReason("");
    setSaved(false);
  };

  const saveChanges = () => {
    if (!reason.trim()) {
      setSaved(false);
      return;
    }
    setSaved(true);
  };

  return (
    <main className="absolute w-[calc(100%_-_312px)] top-24 left-[280px] h-[853px] flex flex-col">
      <div className="w-[159px] h-[18px] [font-family:'Inter-Medium',Helvetica] font-medium text-[#6b6b80] text-xs tracking-[0] leading-[18px] whitespace-nowrap">
        Admin Console&nbsp;&nbsp;/&nbsp;&nbsp;Accounts
      </div>
      <h1 className="w-[130px] h-[42px] mt-[9px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-[#202033] text-[28px] tracking-[0] leading-[42px] whitespace-nowrap">
        Accounts
      </h1>
      <p className="w-[533px] h-[21px] mt-[3px] [font-family:'Inter-Regular',Helvetica] font-normal text-[#6b6b80] text-sm tracking-[0] leading-[21px] whitespace-nowrap">
        Manage roles and account status. Changes to access require a recorded
        reason.
      </p>
      <section
        aria-labelledby="manage-accounts-heading"
        className="w-[1128px] h-[440px] relative mt-[27px] bg-white rounded-xl border border-solid border-[#e8e5ef]"
      >
        <h2
          id="manage-accounts-heading"
          className="absolute top-5 left-6 [font-family:'Inter-SemiBold',Helvetica] font-semibold text-[#202033] text-lg tracking-[0] leading-[27px] whitespace-nowrap"
        >
          Manage accounts
        </h2>
        <div className="absolute top-[25px] left-[1015px] [font-family:'Inter-Medium',Helvetica] font-medium text-[#6b6b80] text-xs tracking-[0] leading-[18px] whitespace-nowrap">
          {accounts.length} accounts
        </div>
        <div
          role="row"
          className="absolute top-16 left-6 w-[1080px] h-10 flex bg-[#f8f7fb] rounded-md"
        >
          {["NAME", "EMAIL", "ROLES", "ACCOUNT STATUS", "ACTION"].map(
            (heading, _index) => (
              <div key={heading}>{heading}</div>
            ),
          )}
        </div>
        {accounts.map((account, index) => {
          const isSelected = account.email === selectedAccount.email;

          return (
            <div
              key={account.email}
              role="row"
              className={`absolute top-[${104 + index * 52}px] left-6 w-[1080px] h-[52px] ${
                isSelected ? "bg-[#f3edff]" : "bg-white"
              }`}
            >
              <div className="absolute top-4 left-3 w-[188px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-[#202033] text-sm tracking-[0] leading-[21px]">
                {account.name}
              </div>
              <div className="absolute top-[17px] left-[212px] w-[264px] [font-family:'Inter-Regular',Helvetica] font-normal text-[#6b6b80] text-[13px] tracking-[0] leading-5">
                {account.email}
              </div>
              <div className="flex w-[228px] items-center gap-1.5 absolute top-4 left-[492px]">
                {account.roles.map((role) => (
                  <span
                    key={role}
                    className={`${badgeClass} ${roleStyles[role]} font-paragraph-mini-bold font-[number:var(--paragraph-mini-bold-font-weight)] text-[length:var(--paragraph-mini-bold-font-size)] text-center tracking-[var(--paragraph-mini-bold-letter-spacing)] leading-[var(--paragraph-mini-bold-line-height)] whitespace-nowrap`}
                  >
                    {role}
                  </span>
                ))}
              </div>
              <span
                className={`absolute top-4 left-[732px] ${badgeClass} ${statusStyles[account.status]} font-paragraph-mini-bold font-[number:var(--paragraph-mini-bold-font-weight)] text-[length:var(--paragraph-mini-bold-font-size)] tracking-[var(--paragraph-mini-bold-letter-spacing)] leading-[var(--paragraph-mini-bold-line-height)] whitespace-nowrap`}
              >
                {account.status}
              </span>
              <button
                type="button"
                onClick={() => selectAccount(account)}
                className={`inline-flex items-center justify-center gap-[var(--spacing-out-of-scale-1-5)] pt-[var(--spacing-out-of-scale-1-5)] pr-[var(--spacing-out-of-scale-2-5)] pb-[var(--spacing-out-of-scale-1-5)] pl-[var(--spacing-out-of-scale-2-5)] absolute top-2.5 left-[972px] rounded-[var(--border-radii-radius-lg-radius)] ${
                  isSelected
                    ? "bg-violet-600 text-white"
                    : "bg-[color:var(--shadcn-colors-alpha-white-outline-bg)] border border-solid border-[color:var(--shadcn-colors-shadcn-colors-general-border)] text-violet-700"
                }`}
                aria-label={`Edit access for ${account.name}`}
              >
                <span className="[font-family:'Inter-SemiBold',Helvetica] font-semibold text-sm leading-5 relative flex items-center justify-center w-fit text-center tracking-[0] whitespace-nowrap">
                  Edit access
                </span>
              </button>
              {isSelected && (
                <div className="absolute top-2.5 left-0 w-[3px] h-8 bg-violet-600" />
              )}

              <div className="absolute top-[51px] left-0 w-[1080px] h-px bg-[#e8e5ef]" />
            </div>
          );
        })}
      </section>
      <section
        aria-labelledby="edit-access-heading"
        className="w-[1128px] h-[260px] relative mt-6 bg-white rounded-xl border border-solid border-[#e8e5ef]"
      >
        <h2
          id="edit-access-heading"
          className="absolute top-5 left-6 [font-family:'Inter-SemiBold',Helvetica] font-semibold text-[#202033] text-lg tracking-[0] leading-[27px] whitespace-nowrap"
        >
          Edit access · {selectedAccount.name}
        </h2>
        <div className="absolute top-[51px] left-6 [font-family:'Inter-Regular',Helvetica] font-normal text-[#6b6b80] text-[13px] tracking-[0] leading-5 whitespace-nowrap">
          {selectedAccount.email}
        </div>
        <div className="absolute top-6 left-[1000px] w-[104px] h-7 flex items-center justify-center bg-[#f3edff] rounded-md">
          <span className="[font-family:'Inter-SemiBold',Helvetica] font-semibold text-violet-600 text-xs tracking-[0] leading-[18px] whitespace-nowrap">
            {saved ? "Saved" : "Editing"}
          </span>
        </div>
        <div className="top-[82px] absolute left-6 w-[1080px] h-px bg-[#e8e5ef]" />
        <label
          htmlFor="account-status"
          className="absolute top-[100px] left-6 [font-family:'Inter-SemiBold',Helvetica] font-semibold text-[#202033] text-[13px] tracking-[0] leading-5 whitespace-nowrap"
        >
          Account status
        </label>
        <div className="absolute top-32 left-6">
          <select
            id="account-status"
            value={selectedStatus}
            onChange={(event) => {
              setSelectedStatus(event.target.value as AccountStatus);
              setSaved(false);
            }}
            className="flex w-[220px] h-10 items-center gap-[var(--spacing-xs)] px-3 rounded-[var(--border-radii-radius-lg-radius)] overflow-hidden border border-solid border-[color:var(--shadcn-colors-shadcn-colors-general-input)] bg-white font-paragraph-small-normal text-slate-900 text-sm outline-none"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
          <img
            className="pointer-events-none absolute top-3 right-3 w-[9.2px] h-4"
            alt=""
            src={vector}
          />
        </div>
        <fieldset className="absolute top-[100px] left-[276px]">
          <legend className="[font-family:'Inter-SemiBold',Helvetica] font-semibold text-[#202033] text-[13px] tracking-[0] leading-5 whitespace-nowrap">
            Roles
          </legend>
          <div className="flex w-[344px] h-5 items-center gap-4 absolute top-10 left-0">
            {(["LEARNER", "INSTRUCTOR", "ADMIN"] as Role[]).map((role) => {
              const checked = selectedRoles.includes(role);

              return (
                <label
                  key={role}
                  className="inline-flex items-center gap-[7px] relative flex-[0_0_auto] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRole(role)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`flex w-4 h-4 items-center justify-center rounded overflow-hidden border ${
                      checked
                        ? "bg-violet-600 border-violet-600 text-white"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    {checked && (
                      <span className="[font-family:'Inter-Regular',Helvetica] text-xs leading-[normal]">
                        ✓
                      </span>
                    )}
                  </span>
                  <span className="[font-family:'Inter-Regular',Helvetica] font-normal text-slate-900 text-sm tracking-[0] leading-[normal]">
                    {role}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <label
          htmlFor="reason"
          className="absolute top-[100px] left-[648px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-[#202033] text-[13px] tracking-[0] leading-5 whitespace-nowrap"
        >
          Reason *
        </label>
        <input
          id="reason"
          type="text"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setSaved(false);
          }}
          placeholder="Enter a reason for changing account access…"
          className="flex w-[456px] h-10 items-center px-3 absolute top-32 left-[648px] rounded-[var(--border-radii-radius-lg-radius)] overflow-hidden border border-solid border-[color:var(--shadcn-colors-shadcn-colors-general-input)] font-paragraph-small-normal text-slate-900 text-sm outline-none placeholder:text-[color:var(--shadcn-colors-shadcn-colors-general-muted-foreground)]"
          required
        />
        <div className="top-[188px] absolute left-6 w-[1080px] h-px bg-[#e8e5ef]" />
        <p className="absolute top-[209px] left-6 [font-family:'Inter-Regular',Helvetica] font-normal text-[#6b6b80] text-xs tracking-[0] leading-[18px] whitespace-nowrap">
          A reason is required when changing account access.
        </p>
        <button
          type="button"
          onClick={saveChanges}
          disabled={!reason.trim()}
          className="flex w-[148px] h-10 items-center justify-center gap-[var(--spacing-out-of-scale-1-5)] pt-[var(--spacing-out-of-scale-1-5)] pr-[var(--spacing-out-of-scale-2-5)] pb-[var(--spacing-out-of-scale-1-5)] pl-[var(--spacing-out-of-scale-2-5)] absolute top-[204px] left-[956px] bg-violet-600 rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="[font-family:'Inter-SemiBold',Helvetica] font-semibold text-white text-sm leading-5 relative flex items-center justify-center w-fit text-center tracking-[0] whitespace-nowrap">
            Save changes
          </span>
        </button>
      </section>
    </main>
  );
};