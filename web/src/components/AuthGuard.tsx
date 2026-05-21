import { useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { setToken } from "../api/client";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      getToken().then((token) => {
        if (token) setToken(token);
      });
    }
  }, [isSignedIn, getToken]);

  return <>{children}</>;
}
