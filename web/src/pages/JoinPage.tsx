import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { fetchWithAuth } from "../api/client";

function ApiKeyGenerator({ orgId, orgName }: { orgId?: string; orgName?: string }) {
  const [key, setKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!orgId) return;
    setCreating(true);
    try {
      const res = await fetchWithAuth("/api/keys", {
        method: "POST",
        body: JSON.stringify({ org_id: orgId, label: "Obsidian — " + orgName }),
      });
      setKey(res.key);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  }

  if (key) {
    return (
      <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-md p-3">
        <p className="text-sm font-medium text-yellow-800">Your key — copy it now:</p>
        <div className="flex items-center gap-2 mt-1">
          <input
            readOnly
            value={key}
            className="flex-1 text-xs font-mono bg-white border border-yellow-300 rounded px-2 py-1"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(key);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="text-xs text-yellow-700 hover:text-yellow-900 font-medium shrink-0"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-yellow-700 mt-1">Paste this into the plugin settings in Obsidian.</p>
      </div>
    );
  }

  return (
    <button
      onClick={create}
      disabled={creating}
      className="mt-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {creating ? "Generating..." : "Generate API key"}
    </button>
  );
}

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const clerk = useClerk();
  const token = searchParams.get("token");

  const [invite, setInvite] = useState<{
    valid: boolean;
    org_id?: string;
    org_name?: string;
    org_slug?: string;
    slack_handle?: string;
    used?: boolean;
    expired?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("No invite token provided.");
      setLoading(false);
      return;
    }
    // Invite validation is public — no auth required
    fetch(`/api/invites/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then((data) => {
        setInvite(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to validate invite.");
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    if (isSignedIn && token && invite?.valid && !joined) {
      doJoin();
    }
  }, [isSignedIn, token, invite, joined]);

  async function doJoin() {
    setJoining(true);
    try {
      await fetchWithAuth(`/api/invites/${encodeURIComponent(token!)}/accept`, {
        method: "POST",
      });
      setJoined(true);
    } catch (err: any) {
      setError(err.message || "Failed to join.");
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-lg shadow-sm border p-6 w-full max-w-sm space-y-3">
          <div className="h-5 w-2/3 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 w-full bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !invite?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-lg shadow-sm border p-6 w-full max-w-sm text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Invite not valid</h1>
          <p className="text-sm text-gray-500 mb-4">
            {error || "This invite link is invalid, expired, or already used."}
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Go to home
          </a>
        </div>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-lg shadow-sm border p-6 w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-lg font-semibold text-gray-900">You're in!</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Welcome to <span className="font-medium text-gray-900">{invite.org_name}</span>
            </p>
          </div>

          <div className="space-y-5">
            {/* Step 1 */}
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-xs font-bold text-blue-700 shrink-0 mt-0.5">1</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Download Obsidian</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Obsidian is a free note-taking app for Mac, Windows, and mobile.
                </p>
                <a
                  href="https://obsidian.md/download"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                >
                  Get Obsidian →
                </a>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-xs font-bold text-blue-700 shrink-0 mt-0.5">2</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Install BRAT</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  BRAT lets you install plugins that are not in the official store yet.
                </p>
                <ol className="text-sm text-gray-500 list-decimal list-inside mt-1 space-y-0.5">
                  <li>Open Obsidian Settings</li>
                  <li>Go to Community plugins</li>
                  <li>Turn on Community plugins if asked</li>
                  <li>Browse → search “BRAT” → Install → Enable</li>
                </ol>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-xs font-bold text-blue-700 shrink-0 mt-0.5">3</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Add the Pushsidian plugin</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  In BRAT, click “Add Beta plugin” and paste this link:
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="flex-1 min-w-0 text-xs font-mono bg-gray-50 border border-gray-200 px-2 py-1.5 rounded truncate">
https://github.com/duyemura/pushsidian
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("https://github.com/duyemura/pushsidian");
                      setCopiedId("repo");
                      setTimeout(() => setCopiedId(null), 2000);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0"
                  >
                    {copiedId === "repo" ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  BRAT will download the plugin. Then go back to Community plugins and turn on Pushsidian.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-xs font-bold text-blue-700 shrink-0 mt-0.5">4</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Connect your account</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  When you first open Pushsidian in Obsidian, it will ask for an API key. Copy the key below and paste it in.
                </p>
                <ApiKeyGenerator orgId={invite.org_id} orgName={invite.org_name} />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t text-center">
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Go to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-lg shadow-sm border p-6 w-full max-w-sm text-center">
        <h1 className="text-lg font-semibold text-gray-900">
          Join {invite.org_name}
        </h1>
        <p className="text-sm text-gray-500 mt-1 mb-5">
          You've been invited to the team.
        </p>

        {isSignedIn ? (
          <button
            onClick={doJoin}
            disabled={joining}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {joining ? "Joining..." : "Accept invite"}
          </button>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => clerk.openSignUp({ redirectUrl: window.location.href })}
              className="block w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Sign up and join
            </button>
            <button
              onClick={() => clerk.openSignIn({ redirectUrl: window.location.href })}
              className="block w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Sign in and join
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
