"use client";

import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <Button variant="ghost" onClick={handleLogout} disabled={isLoading}>
      <LogOut className="h-4 w-4 mr-2" />
      {isLoading ? "Signing out..." : "Sign Out"}
    </Button>
  );
}
