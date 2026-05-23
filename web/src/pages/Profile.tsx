import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchWithAuth } from "../api/client";

interface Org {
  id: string;
  slug: string;
  display_name: string;
  role: string;
}

interface ApiKey {
  id: string;
  label: string | null;
  org_name: string;
  created_at: string;
  last_used_at: string | null;
}

export default function Profile() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [label, setLabel] = useState("");

  useEffect(() => {
    fetchWithAuth("/api/user/orgs")
      .then((data: Org[]) => {
        setOrgs(data);
        if (data.length > 0) setSelectedOrg(data[0].id);
      })
      .catch(() => {});
    loadKeys();
  }, []);

  const loadKeys = () => {
    fetchWithAuth("/api/keys")
      .then((data: ApiKey[]) => setKeys(data))
      .catch(() => {});
  };

  const createKey = async () => {
    if (!selectedOrg) return;
    try {
      const res = await fetchWithAuth("/api/keys", {
        method: "POST",
        body: JSON.stringify({ org_id: selectedOrg, label: label || undefined }),
      });
      setNewKey(res.key);
      setLabel("");
      loadKeys();
    } catch {
      // ignore
    }
  };

  const revokeKey = async (id: string) => {
    await fetchWithAuth(`/api/keys/${id}`, { method: "DELETE" });
    loadKeys();
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-sm font-medium text-gray-700">Organizations</h2>
        {orgs.length === 0 ? (
          <div className="text-sm text-gray-600">
            <p>No organizations yet.</p>
            <Link
              to="/onboarding"
              className="inline-flex items-center mt-2 px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Create organization
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {orgs.map((org) => (
              <div key={org.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{org.display_name}</div>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">{org.id}</div>
                </div>
                <button
                  onClick={() => copy(org.id, org.id)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {copiedId === org.id ? "Copied" : "Copy ID"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-sm font-medium text-gray-700">Obsidian API keys</h2>
        <p className="text-sm text-gray-500">
          Generate a key and paste it into your Obsidian plugin settings.
        </p>

        {newKey && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm font-medium text-yellow-800">New key created — copy it now:</p>
            <div className="flex items-center gap-2 mt-1">
              <input
                readOnly
                value={newKey}
                className="flex-1 text-xs font-mono bg-white border border-yellow-300 rounded px-2 py-1"
              />
              <button
                onClick={() => copy(newKey, "new")}
                className="text-xs text-yellow-700 hover:text-yellow-900 font-medium"
              >
                {copiedId === "new" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-yellow-700 mt-1">This is the only time you will see it.</p>
          </div>
        )}

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Organization</label>
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.display_name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="MacBook Pro"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={createKey}
            disabled={!selectedOrg}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            Generate key
          </button>
        </div>

        {keys.length > 0 && (
          <div className="divide-y divide-gray-100">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{k.label || "Unnamed key"}</div>
                  <div className="text-xs text-gray-500">
                    {k.org_name} · Created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                  </div>
                </div>
                <button
                  onClick={() => revokeKey(k.id)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
