import { useState, useEffect } from "react";
import { marked } from "marked";
import { fetchWithAuth } from "../api/client";

function stripFrontmatter(content: string): string {
  return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
}

interface Document {
  id: string;
  obsidian_path: string;
  title: string | null;
  owner_id: string;
  owner_name: string;
  version: number;
  updated_at: string;
  share_summary: string;
}

interface Org {
  id: string;
  slug: string;
  display_name: string;
  role: string;
}

type FolderNode = {
  name: string;
  path: string;
  folders: FolderNode[];
  files: Document[];
};

function buildFolderTree(docs: Document[]): FolderNode {
  const root: FolderNode = { name: "", path: "", folders: [], files: [] };
  for (const doc of docs) {
    const parts = doc.obsidian_path.split("/");
    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      let next = current.folders.find((f) => f.name === folderName);
      if (!next) {
        next = { name: folderName, path: parts.slice(0, i + 1).join("/"), folders: [], files: [] };
        current.folders.push(next);
      }
      current = next;
    }
    current.files.push(doc);
  }
  return root;
}

function FolderTree({
  node,
  depth = 0,
  onFileClick,
}: {
  node: FolderNode;
  depth?: number;
  onFileClick: (doc: Document) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  return (
    <div className="select-none">
      {node.name !== "" && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 w-full text-left text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded px-2 py-1"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <svg
            className={`w-3 h-3 text-gray-400 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4.5 2.5L8 6l-3.5 3.5" />
          </svg>
          <span className="truncate">{node.name}</span>
        </button>
      )}
      {expanded && (
        <div>
          {node.folders.map((folder) => (
            <FolderTree key={folder.path} node={folder} depth={depth + 1} onFileClick={onFileClick} />
          ))}
          {node.files.map((doc) => (
            <button
              key={doc.id}
              onClick={() => onFileClick(doc)}
              className="flex items-center gap-2 w-full text-left text-sm text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded px-2 py-1"
              style={{ paddingLeft: `${(depth + 1) * 12 + 20}px` }}
            >
              <span className="truncate">{doc.title || doc.obsidian_path.split("/").pop()}</span>
              <span
                className={`ml-auto shrink-0 text-[10px] px-1 py-0.5 rounded ${
                  doc.share_summary === "Everyone"
                    ? "bg-blue-100 text-blue-700"
                    : doc.share_summary === "Private"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-purple-100 text-purple-700"
                }`}
              >
                {doc.share_summary}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="text-6xl mb-4">📚</div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Select a document</h2>
      <p className="text-gray-500 text-sm max-w-xs">
        Choose a file from the sidebar to view its contents.
      </p>
    </div>
  );
}

export default function Dashboard() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [docs, setDocs] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [docContent, setDocContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set());
  const [justUpdated, setJustUpdated] = useState(false);

  useEffect(() => {
    fetchWithAuth("/api/user/orgs")
      .then((data: Org[]) => {
        if (data.length === 0) {
          window.location.href = "/onboarding";
          return;
        }
        setOrgs(data);
        setSelectedOrg(data[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function loadDocs(orgId: string, isPoll = false) {
    if (!isPoll) setDocsLoading(true);
    try {
      const data: Document[] = await fetchWithAuth(`/api/documents?org_id=${encodeURIComponent(orgId)}`);
      setDocs((prev) => {
        // On poll, check if selected doc got a new version
        if (isPoll && selectedDoc) {
          const updated = data.find((d) => d.id === selectedDoc.id);
          if (updated && updated.version !== selectedDoc.version) {
            setSelectedDoc(updated);
            void reloadContent(updated.id);
            setJustUpdated(true);
            setTimeout(() => setJustUpdated(false), 3000);
          }
        }
        return data;
      });
      if (!isPoll) {
        setDocsLoading(false);
        const peopleWithDocs = new Set(data.map((d) => d.owner_id));
        setExpandedPeople(peopleWithDocs);
      }
    } catch (err: any) {
      if (!isPoll) {
        setError(err.message);
        setDocsLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!selectedOrg) return;
    loadDocs(selectedOrg);
  }, [selectedOrg]);

  // Poll for updates every 5 seconds
  useEffect(() => {
    if (!selectedOrg) return;
    const interval = setInterval(() => {
      loadDocs(selectedOrg, true);
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedOrg, selectedDoc]);

  async function reloadContent(docId: string) {
    try {
      const res = await fetchWithAuth(`/api/documents/${docId}/content`);
      setDocContent(res.content ?? "No content.");
    } catch {
      setDocContent("Failed to load document content.");
    }
  }

  async function handleFileClick(doc: Document) {
    setSelectedDoc(doc);
    setContentLoading(true);
    try {
      const res = await fetchWithAuth(`/api/documents/${doc.id}/content`);
      setDocContent(res.content ?? "No content.");
    } catch {
      setDocContent("Failed to load document content.");
    } finally {
      setContentLoading(false);
    }
  }

  function togglePerson(ownerId: string) {
    setExpandedPeople((prev) => {
      const next = new Set(prev);
      if (next.has(ownerId)) {
        next.delete(ownerId);
      } else {
        next.add(ownerId);
      }
      return next;
    });
  }

  // Group docs by owner
  const docsByOwner = new Map<string, Document[]>();
  for (const doc of docs) {
    const arr = docsByOwner.get(doc.owner_id) || [];
    arr.push(doc);
    docsByOwner.set(doc.owner_id, arr);
  }

  // Sort owners: You first, then alphabetically
  const owners = Array.from(docsByOwner.entries()).sort((a, b) => {
    const aName = a[1][0]?.owner_name || "";
    const bName = b[1][0]?.owner_name || "";
    if (aName === "You") return -1;
    if (bName === "You") return 1;
    return aName.localeCompare(bName);
  });

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900">Team Knowledge</h1>
          {docsLoading && <span className="text-xs text-gray-400">Loading...</span>}
        </div>
        {orgs.length > 0 && (
          <select
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm"
          >
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.display_name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-72 shrink-0 border-r bg-gray-50 overflow-y-auto">
          {docsLoading ? (
            <div className="p-4 space-y-2">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse ml-4" />
              <div className="h-4 w-40 bg-gray-200 rounded animate-pulse ml-4" />
            </div>
          ) : docs.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">
              No shared documents yet. Share a note from Obsidian with the{" "}
              <code className="bg-gray-100 px-1 rounded text-xs">share</code> frontmatter key.
            </div>
          ) : (
            <div className="py-2">
              {owners.map(([ownerId, ownerDocs]) => {
                const ownerName = ownerDocs[0]?.owner_name || "Unknown";
                const isExpanded = expandedPeople.has(ownerId);
                const tree = buildFolderTree(ownerDocs);
                return (
                  <div key={ownerId} className="mb-1">
                    <button
                      onClick={() => togglePerson(ownerId)}
                      className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm font-medium hover:bg-gray-100 ${
                        ownerName === "You" ? "text-green-700" : "text-gray-900"
                      }`}
                    >
                      <svg
                        className={`w-3 h-3 text-gray-400 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4.5 2.5L8 6l-3.5 3.5" />
                      </svg>
                      <span>{ownerName}</span>
                      <span className="ml-auto text-xs text-gray-400">{ownerDocs.length}</span>
                    </button>
                    {isExpanded && (
                      <div className="pb-1">
                        <FolderTree node={tree} onFileClick={handleFileClick} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto bg-white">
          {!selectedDoc ? (
            <EmptyState />
          ) : (
            <div className="max-w-3xl mx-auto p-6">
              {/* Header */}
              <div className="mb-6 pb-4 border-b">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedDoc.title || selectedDoc.obsidian_path.split("/").pop()}
                  </h2>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      selectedDoc.share_summary === "Everyone"
                        ? "bg-blue-100 text-blue-700"
                        : selectedDoc.share_summary === "Private"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {selectedDoc.share_summary}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span>{selectedDoc.owner_name}</span>
                  <span>·</span>
                  <span>{selectedDoc.obsidian_path}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1.5">
                    v{selectedDoc.version}
                    {justUpdated && (
                      <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded animate-pulse">
                        Updated
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Content */}
              {contentLoading ? (
                <div className="space-y-3">
                  <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-4/6 bg-gray-200 rounded animate-pulse" />
                </div>
              ) : (
                <div
                  className="prose prose-sm max-w-none text-gray-800"
                  dangerouslySetInnerHTML={{ __html: marked.parse(stripFrontmatter(docContent || "")) }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
