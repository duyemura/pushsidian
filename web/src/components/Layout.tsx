import { Link } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-6">
              <Link to="/" className="text-xl font-bold text-gray-900">
                Pushsidian
              </Link>
              <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">
                Dashboard
              </Link>
              <Link to="/team" className="text-sm text-gray-600 hover:text-gray-900">
                Team
              </Link>
            </div>
            <div className="flex items-center">
              <UserButton />
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
