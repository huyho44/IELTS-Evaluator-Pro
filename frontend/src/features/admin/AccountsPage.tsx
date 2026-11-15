import { useState } from "react";
import ActionForm from "../management/ActionForm";
import {
  field,
  managementRequest,
  panel,
  type UserRow,
} from "../management/managementApi";
import { getRoleBadgeClass } from "../management/workspaceTheme";
import AdminSection from "./AdminSection";
import { useAdminSection } from "./useAdminSection";

const loadAccounts = () => managementRequest<UserRow[]>("GET", "/admin/users");

const ROLE_OPTIONS = [
  {
    value: "LEARNER",
    label: "LEARNER",
    hint: "Course enrollment, lessons, and practice attempts",
  },
  {
    value: "INSTRUCTOR",
    label: "INSTRUCTOR",
    hint: "Review queue, grading confirmation, and course authoring",
  },
  {
    value: "ADMIN",
    label: "ADMIN",
    hint: "Account governance, approvals, catalog, and AI configuration",
  },
];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  SUSPENDED: "border border-amber-200 bg-amber-50 text-amber-800",
  CLOSED: "border border-slate-200 bg-slate-100 text-slate-700",
};

export default function AccountsPage() {
  const section = useAdminSection(loadAccounts);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleValidationError, setRoleValidationError] = useState("");

  const accounts = section.data ?? [];
  const selected = accounts.find((account) => account.id === selectedId);
  const keyword = query.trim().toLowerCase();
  const filtered = accounts.filter((account) => {
    const matchesKeyword =
      !keyword ||
      `${account.displayName} ${account.email} ${account.roles.join(" ")} ${account.status}`
        .toLowerCase()
        .includes(keyword);
    const matchesRole =
      roleFilter === "ALL" || account.roles.includes(roleFilter);
    const matchesStatus =
      statusFilter === "ALL" || account.status === statusFilter;
    return matchesKeyword && matchesRole && matchesStatus;
  });

  const hasFilters = Boolean(keyword || roleFilter !== "ALL" || statusFilter !== "ALL");

  return (
    <AdminSection
      title="Accounts"
      description="Search user accounts, inspect status and roles, and record an audit reason before saving access changes."
      {...section}
    >
      <div
        className={
          selected
            ? "grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]"
            : "space-y-4"
        }
      >
        <section
          id="accounts-directory-table"
          className={`${panel} min-w-0 scroll-mt-20 shadow-2xs`}
          aria-label="Account directory"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                User directory
              </h2>
              <p className="text-xs text-slate-500">
                Select Edit on any account row to modify workspace status or assigned roles.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selected && (
                <a
                  href="#account-access-editor"
                  className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-900 xl:hidden"
                >
                  Jump to editor &darr;
                </a>
              )}
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-900">
                {filtered.length} of {accounts.length} accounts
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className={`${field} mt-1 font-normal`}
                placeholder="Search by name, email, role, or status"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Role
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className={`${field} mt-1 font-normal`}
              >
                <option value="ALL">All roles</option>
                <option value="LEARNER">LEARNER</option>
                <option value="INSTRUCTOR">INSTRUCTOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={`${field} mt-1 font-normal`}
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </label>
          </div>

          {hasFilters && (
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span>
                Showing {filtered.length} matching account
                {filtered.length === 1 ? "" : "s"}.
              </span>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setRoleFilter("ALL");
                  setStatusFilter("ALL");
                }}
                className="font-semibold text-violet-800 hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-200/80">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-violet-100 bg-violet-50/70 text-xs font-semibold uppercase tracking-wide text-violet-950">
                <tr>
                  {["Account", "Roles", "Status", "Action"].map((heading) => (
                    <th key={heading} scope="col" className="px-4 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filtered.map((account) => {
                  const isEditing = selectedId === account.id;
                  return (
                    <tr
                      key={account.id}
                      className={
                        isEditing
                          ? "bg-violet-50/60"
                          : "transition-colors hover:bg-slate-50/80"
                      }
                    >
                      <th scope="row" className="px-4 py-3.5 font-semibold">
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                              isEditing
                                ? "bg-violet-700 text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {account.displayName.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {account.displayName}
                            </p>
                            <p className="truncate break-all text-xs font-normal text-slate-500">
                              {account.email}
                            </p>
                          </div>
                        </div>
                      </th>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {account.roles.length ? (
                            account.roles.map((role) => (
                              <span
                                key={role}
                                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${getRoleBadgeClass(role)}`}
                              >
                                {role}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            STATUS_BADGE[account.status] ??
                            "border border-slate-200 bg-slate-100 text-slate-700"
                          }`}
                        >
                          {account.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(isEditing ? "" : account.id);
                            setRoleValidationError("");
                          }}
                          aria-label={`Edit ${account.displayName}`}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            isEditing
                              ? "bg-violet-700 text-white"
                              : "border border-violet-200 bg-white text-violet-900 hover:bg-violet-50"
                          }`}
                        >
                          {isEditing ? "Editing" : "Edit"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {section.data && !filtered.length && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-600">
              No accounts match your current search or filter criteria.
            </div>
          )}
        </section>

        {selected && (
          <div
            id="account-access-editor"
            className="min-w-0 space-y-2 scroll-mt-20 xl:sticky xl:top-20"
          >
            <div className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50/70 px-3.5 py-2 text-xs">
              <a
                href="#accounts-directory-table"
                className="font-semibold text-violet-900 hover:underline xl:hidden"
              >
                &uarr; Back to user directory
              </a>
              <span className="hidden font-semibold text-violet-900 xl:inline">
                Contextual access editor
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedId("");
                  setRoleValidationError("");
                }}
                className="font-semibold text-slate-600 hover:text-slate-900"
              >
                Close editor
              </button>
            </div>
            <ActionForm
              key={`${selected.id}:${selected.status}:${selected.roles.join()}`}
              title="Edit account access"
              description="Review the target account details before applying status or role updates."
              variant="admin"
              label="Save changes"
              busy={section.busy}
              submit={async (data) => {
                const roles = data.getAll("roles");
                if (!roles.length) {
                  setRoleValidationError(
                    "Select at least one role before saving.",
                  );
                  return false;
                }
                setRoleValidationError("");
                return section.run("PATCH", `/admin/users/${selected.id}`, {
                  status: data.get("status"),
                  roles,
                  reason: data.get("reason"),
                });
              }}
            >
              <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                      Target account
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-950">
                      {selected.displayName}
                    </p>
                    <p className="truncate break-all text-xs text-slate-600">
                      {selected.email}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      STATUS_BADGE[selected.status] ??
                      "border border-slate-200 bg-slate-100 text-slate-700"
                    }`}
                  >
                    {selected.status}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {selected.roles.map((role) => (
                    <span
                      key={role}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getRoleBadgeClass(role)}`}
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              <label className="block text-sm font-medium text-slate-800">
                Account status
                <select
                  name="status"
                  defaultValue={selected.status}
                  className={`${field} mt-1.5`}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </label>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-800">
                  Assigned roles
                </legend>
                <div className="space-y-2">
                  {ROLE_OPTIONS.map((role) => (
                    <label
                      key={role.value}
                      className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-sm hover:border-violet-200 hover:bg-violet-50/30"
                    >
                      <input
                        type="checkbox"
                        name="roles"
                        value={role.value}
                        defaultChecked={selected.roles.includes(role.value)}
                        onChange={() => setRoleValidationError("")}
                        className="mt-0.5 size-4 rounded border-slate-300 text-violet-700 focus:ring-violet-600"
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-slate-900">
                          {role.label}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {role.hint}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {roleValidationError && (
                  <p role="alert" className="text-xs font-medium text-red-700">
                    {roleValidationError}
                  </p>
                )}
              </fieldset>

              <label className="block text-sm font-medium text-slate-800">
                Reason <span className="text-red-600">*</span>
                <textarea
                  required
                  name="reason"
                  rows={3}
                  maxLength={10000}
                  placeholder="Explain why status or roles are being changed..."
                  className={`${field} mt-1.5`}
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Required. Recorded for audit traceability whenever access changes.
                </span>
              </label>
            </ActionForm>
          </div>
        )}
      </div>
    </AdminSection>
  );
}
