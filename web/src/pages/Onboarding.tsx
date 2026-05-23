import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../api/client";

export default function Onboarding() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await fetchWithAuth("/api/orgs", {
        method: "POST",
        body: JSON.stringify({
          display_name: displayName.trim(),
          slug: slug.trim().toLowerCase().replace(/\s+/g, "-"),
        }),
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Pushsidian</h1>
          <p className="mt-2 text-gray-600">
            Create an organization to start sharing knowledge with your team.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
              Organization name
            </label>
            <input
              id="displayName"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="PushPress Engineering"
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
              URL slug
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">
                pushsidian.com/
              </span>
              <input
                id="slug"
                type="text"
                required
                value={slug}
                onChange={(e) =>
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
                className="block w-full flex-1 rounded-none rounded-r-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                placeholder="pushpress"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Letters, numbers, and hyphens only.</p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-md p-3">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create organization"}
          </button>
        </form>
      </div>
    </div>
  );
}
