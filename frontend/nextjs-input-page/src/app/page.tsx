"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/map");
  }, [router]);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      background: "#0a0e1a",
      color: "#94a3b8",
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "0.9rem",
    }}>
      Redirecting to map...
    </div>
  );
}
