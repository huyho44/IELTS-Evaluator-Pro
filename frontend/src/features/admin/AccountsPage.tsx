import { useState } from "react";
import ActionForm from "../management/ActionForm";
import {
  field,
  managementRequest,
  panel,
  type UserRow,
} from "../management/managementApi";
import AdminSection from "./AdminSection";
import { useAdminSection } from "./useAdminSection";

const loadAccounts = () => managementRequest<UserRow[]>("GET", "/admin/users");

export default function AccountsPage() {
  const section = useAdminSection(loadAccounts);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const accounts = section.data ?? [];
  const selected = accounts.find((account) => account.id === selectedId);
  const keyword = query.trim().toLowerCase();
  const filtered = accounts.filter(({ displayName, email }) =>
    (displayName + " " + email).toLowerCase().includes(keyword),
  );

  return (
    <AdminSection
      title="Accounts"
      description="Manage account status and roles. Access changes require a recorded reason."
      {...section}
    >
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <section className={panel} aria-label="Account directory">
          <label className="block text-sm font-semibold">
            Search accounts
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={field + " mt-1"}
              placeholder="Name or email"
            />
          </label>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-violet-50 text-violet-950">
                <tr>
                  {["Account", "Roles", "Status", "Action"].map((heading) => (
                    <th key={heading} scope="col" className="px-3 py-2">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((account) => (
                  <tr
                    key={account.id}
                    className={selectedId === account.id ? "bg-violet-50" : ""}
                  >
                    <th scope="row" className="px-3 py-3 font-semibold">
                      {account.displayName}
                      <span className="block break-all text-xs font-normal text-slate-600">
                        {account.email}
                      </span>
                    </th>
                    <td className="px-3 py-3">
                      {account.roles.join(", ") || "—"}
                    </td>
                    <td className="px-3 py-3">{account.status}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className="font-semibold text-violet-800 underline"
                        onClick={() => setSelectedId(account.id)}
                        aria-label={`Edit ${account.displayName}`}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {section.data && !filtered.length && (
            <p className="text-sm text-slate-600">No accounts found.</p>
          )}
        </section>
        {selected && (
          <ActionForm
            key={`${selected.id}:${selected.status}:${selected.roles.join()}`}
            title={`Edit ${selected.displayName}`}
            busy={section.busy}
            submit={(data) =>
              section.run("PATCH", `/admin/users/${selected.id}`, {
                status: data.get("status"),
                roles: data.getAll("roles"),
                reason: data.get("reason"),
              })
            }
          >
            <label className="block text-sm">
              Account status
              <select
                name="status"
                defaultValue={selected.status}
                className={field}
              >
                <option>ACTIVE</option>
                <option>SUSPENDED</option>
                <option>CLOSED</option>
              </select>
            </label>
            <fieldset className="space-y-1">
              <legend className="text-sm">Roles</legend>
              {["LEARNER", "INSTRUCTOR", "ADMIN"].map((role) => (
                <label key={role} className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="roles"
                    value={role}
                    defaultChecked={selected.roles.includes(role)}
                  />{" "}
                  {role}
                </label>
              ))}
            </fieldset>
            <label className="block text-sm">
              Reason{" "}
              <textarea
                required
                name="reason"
                maxLength={10000}
                className={field}
              />
            </label>
          </ActionForm>
        )}
      </div>
    </AdminSection>
  );
}
