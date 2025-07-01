/// <reference types="chrome" />
"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ExtensionAuthPage() {
  const { getToken } = useAuth();
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [status, setStatus] = useState("Checking authentication...");
  const [error, setError] = useState("");

  useEffect(() => {
    // Sprawdź czy dane użytkownika są załadowane
    if (!isLoaded) {
      return;
    }

    // Jeśli nie jest zalogowany, przekieruj na logowanie
    if (!isSignedIn) {
      console.log("🚫 User not signed in, redirecting to sign-up...");
      setStatus("Not authenticated - redirecting to login...");
      router.push("/sign-up");
      return;
    }

    // Użytkownik jest zalogowany, kontynuuj z pozyskiwaniem tokenu
    setStatus("User authenticated, getting token...");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    // Tylko wykonaj jeśli użytkownik jest zalogowany
    if (!isLoaded || !isSignedIn) {
      return;
    }

        const storeToken = async () => {
      console.log("🚀 Extension auth page - Starting token fetch...");
      setStatus("Getting auth token...");
      try {
        console.log("📞 Calling getToken with template 'convex'...");
        const token = await getToken({ template: "convex" });
        console.log("🎯 Token received:", token ? `${token.substring(0, 20)}...` : "null");

        if (!token) {
          console.error("❌ No token received from Clerk");
          setStatus("Error");
          setError("Failed to retrieve authentication token. Are you logged in?");
          return;
        }

        // Debug token contents
        try {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            console.log("🔍 Token payload debug:", {
              iss: payload.iss,
              aud: payload.aud,
              exp: payload.exp,
              sub: payload.sub?.substring(0, 10) + "..."
            });
          }
        } catch {
          console.warn("⚠️ Could not decode token for debugging");
        }

        // Zapisz token w localStorage tej strony.
        // Skrypt tła wtyczki go stąd odczyta.
        console.log("💾 Storing token in localStorage...");
        localStorage.setItem("vibeplanner_extension_token_sync", token);
        console.log("✅ Token stored successfully");
        
        setStatus("Authentication successful! Check the console for logs, then close this tab manually.");
        setError(""); // Wyczyść ewentualne poprzednie błędy

        // Wyłączamy auto-zamykanie żeby móc sprawdzić logi
        // setTimeout(() => {
        //   console.log("🚪 Auto-closing tab...");
        //   window.close();
        // }, 2000);

      } catch (e: unknown) {
        console.error("❌ Auth Error:", e);
        console.error("❌ Error details:", {
          message: e instanceof Error ? e.message : 'Unknown error',
          stack: e instanceof Error ? e.stack : undefined,
          name: e instanceof Error ? e.name : 'UnknownError'
        });
        setStatus("Error");
        setError(`An error occurred: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    };

    storeToken();
  }, [getToken, isLoaded, isSignedIn]);

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", textAlign: "center", color: "#333" }}>
      <h1>VibePlanner Extension Authentication</h1>
      <h2 style={{ color: error ? 'red' : 'green' }}>{status}</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <p>Please do not close this window. It will close automatically.</p>
    </div>
  );
} 