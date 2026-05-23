import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchWithAuth } from "../api/client";

interface Member {
  id: string;
  display_name: string;
  email: string | null;
  role: string;
}

interface Group {
  id: string;
  display_name: string;
  slug: string;
}

interface Org {
  id: string;
  display_name: string;
}

interface Invite {
  id: string;
  slack_handle: string | null;
  role: string;
  token: string;
  used_by: string | null;
  used_at: string | null;
  expires_at: string;
}

export default function TeamSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlOrgId = searchParams.get("org") || "";
  const [orgId, setOrgId] = useState(urlOrgId);

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [slackHandle, setSlackHandle] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSaved, setWebhookSaved] = useState(false);

  useEffect(() => {
    fetchWithAuth("/api/user/orgs").then((data: Org[]) => {
      setOrgs(data);
      if (data.length > 0 && !orgId) {
        loadOrg(data[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (orgId) loadOrg(orgId);
  }, [orgId]);

  async function loadOrg(id: string) {
    setOrgId(id);
    setSearchParams({ org: id });
    setLoading(true);
    const [m, i, org] = await Promise.all([
      fetchWithAuth(`/api/orgs/${id}/members`),
      fetchWithAuth(`/api/invites/org/${id}`),
      fetchWithAuth(`/api/orgs/${id}`),
    ]);
    setMembers(m);
    setInvites(i);
    setWebhookUrl(org.slack_webhook_url ?? "");
    setLoading(false);
  }

  async function createInvite() {
    if (!slackHandle || !orgId) {
      setInviteError("Please select an organization and enter a Slack handle.");
      return;
    }
    setGenerating(true);
    setInviteError(null);
    try {
      const res = await fetchWithAuth("/api/invites", {
        method: "POST",
        body: JSON.stringify({
          org_id: orgId,
          slack_handle: slackHandle,
          groups: [],
          role,
        }),
      });
      setSlackHandle("");
      setRole("member");
      loadOrg(orgId);
      return res.link;
    } catch (err: any) {
      setInviteError(err.message || "Failed to create invite.");
    } finally {
      setGenerating(false);
    }
  }

  function copyLink(link: string, id: string) {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function saveWebhook() {
    if (!orgId) return;
    try {
      await fetchWithAuth(`/api/orgs/${orgId}`, {
        method: "PATCH",
        body: JSON.stringify({
          slack_webhook_url: webhookUrl || null,
        }),
      });
      setWebhookSaved(true);
      setTimeout(() => setWebhookSaved(false), 2000);
    } catch (err: any) {
      setInviteError(err.message || "Failed to save webhook.");
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Team settings</h1>

      {orgs.length > 1 && (
        <select
          value={orgId || orgs[0]?.id}
          onChange={(e) => loadOrg(e.target.value)}
          className="block w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.display_name}
            </option>
          ))}
        </select>
      )}

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-sm font-medium text-gray-700">Invite teammate</h2>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Slack handle</label>
            <input
              type="text"
              value={slackHandle}
              onChange={(e) => setSlackHandle(e.target.value)}
              placeholder="@alice"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "member" | "admin")}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            onClick={createInvite}
            disabled={!slackHandle || generating}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate link"}
          </button>
        </div>

        {inviteError && (
          <p className="text-sm text-red-600">{inviteError}</p>
        )}
        <p className="text-xs text-gray-500">
          New members can access all shared documents.
        </p>

        {invites.length > 0 && (
          <div className="mt-4 space-y-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between border rounded-md px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{inv.slack_handle ?? "Unknown"}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      inv.used_by
                        ? "bg-green-100 text-green-700"
                        : new Date(inv.expires_at) < new Date()
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {inv.used_by ? "Joined" : new Date(inv.expires_at) < new Date() ? "Expired" : "Pending"}
                  </span>
                </div>
                {!inv.used_by && (
                  <button
                    onClick={() =>
                      copyLink(
                        `${window.location.origin}/join?token=${inv.token}`,
                        inv.id
                      )
                    }
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    {copiedId === inv.id ? "Copied" : "Copy link"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-sm font-medium text-gray-700">Slack notifications</h2>
        <p className="text-xs text-gray-500">
          Paste a Slack incoming webhook URL to post updates when documents are shared.
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={saveWebhook}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            {webhookSaved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Members</h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-500">No members yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {m.display_name}
                  </div>
                  {m.email && (
                    <div className="text-xs text-gray-500">{m.email}</div>
                  )}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
