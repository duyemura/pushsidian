import { Routes, Route } from "react-router-dom";
import { SignedIn, SignedOut, SignIn, SignUp } from "@clerk/clerk-react";
import AuthGuard from "./components/AuthGuard";
import Dashboard from "./pages/Dashboard";
import TeamSettings from "./pages/TeamSettings";
import Layout from "./components/Layout";

function App() {
  return (
    <Routes>
      <Route
        path="/sign-in/*"
        element={
          <div className="flex items-center justify-center min-h-screen">
            <SignIn routing="path" path="/sign-in" />
          </div>
        }
      />
      <Route
        path="/sign-up/*"
        element={
          <div className="flex items-center justify-center min-h-screen">
            <SignUp routing="path" path="/sign-up" />
          </div>
        }
      />
      <Route
        path="/*"
        element={
          <>
            <SignedOut>
              <div className="flex items-center justify-center min-h-screen">
                <SignIn />
              </div>
            </SignedOut>
            <SignedIn>
              <AuthGuard>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/team" element={<TeamSettings />} />
                  </Routes>
                </Layout>
              </AuthGuard>
            </SignedIn>
          </>
        }
      />
    </Routes>
  );
}

export default App;
