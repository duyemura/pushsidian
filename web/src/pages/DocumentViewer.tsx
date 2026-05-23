import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { marked } from "marked";
import { fetchWithAuth } from "../api/client";

function stripFrontmatter(content: string): string {
  return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
}

interface DocumentMeta {
  id: string;
  obsidian_path: string;
  title: string | null;
  content_url: string;
  version: number;
  updated_at: string;
}

interface DocRule {
  subject_id: string;
  display_name: string;
  relation: string;
}

export default function DocumentViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<DocumentMeta | null>(null);
  const [content, setContent] = useState<string>("");
  const [rules, setRules] = useState<DocRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        const [doc, rulesData] = await Promise.all([
          fetchWithAuth(`/api/documents/${id}`),
          fetchWithAuth(`/api/documents/${id}/rules`).catch(() => []),
        ]);
        setMeta(doc);
        setRules(rulesData);

        const token = window.localStorage.getItem("clerk-token");
        const contentRes = await fetch(`/api/documents/${id}/content`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!contentRes.ok) throw new Error("Failed to load document content");
        const text = await contentRes.text();
        setContent(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load document");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 text-gray-600">Loading document...</div>
    );
  }

  if (error || !meta) {
    return (
      <div className="p-8 text-red-600">Error: {error || "Document not found"}</div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-sm text-gray-600 hover:text-gray-900">
        &larr; Back
      </button>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {meta.title || meta.obsidian_path}
            </h1>
            <p className="text-sm text-gray-500 font-mono mt-1">{meta.obsidian_path}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                v{meta.version}
              </span>
              <span className="text-sm text-gray-500">
                {new Date(meta.updated_at).toLocaleDateString()}
              </span>
            </div>
            {rules.length > 0 && (
              <div className="text-xs text-gray-500">
                Shared with:{" "}
                {rules.map((r) => r.display_name).join(", ")}
              </div>
            )}
          </div>
        </div>

        <div
          className="prose prose-slate max-w-none px-6 py-6"
          dangerouslySetInnerHTML={{ __html: marked.parse(stripFrontmatter(content), { async: false }) as string }}
        />
      </div>
    </div>
  );
}
