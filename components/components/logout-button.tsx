"use client";

import { useTransition } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { signOut } from "next-auth/react";

export default function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
  startTransition(async () => {
    try {
      await signOut({
        redirect: false,
      });

      window.location.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  });
};

  return (
    <button
      onClick={handleLogout}
      disabled={isPending}
      className="
        inline-flex items-center justify-center gap-2
        rounded-lg bg-blue-600
        px-6 py-3
        text-white
        shadow
        transition-all duration-300
        hover:bg-blue-700
        disabled:cursor-not-allowed
        disabled:opacity-80
      "
    >
      {isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Logging out...
        </>
      ) : (
        <>
          <LogOut className="h-4 w-4" />
          Logout
        </>
      )}
    </button>
  );
}