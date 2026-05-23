import { useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { registerTokenGetter, setToken } from "../api/client";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    // Register Clerk's getToken so fetchWithAuth always uses a fresh JWT
    registerTokenGetter(() => getToken({ skipCache: true }));
    if (isSignedIn) {
      getToken({ skipCache: true }).then((token) => {
        if (token) setToken(token);
      });
    }
  }, [isSignedIn, getToken]);

  return <>{children}</>;
}
