// DEPRECATED: This component is unused (only referenced in .bak files)
// Use ProfileMenu component instead for sign out functionality
// Keeping file for reference but marked for deletion

"use client";

import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut } from 'lucide-react';
import { useState } from "react";

export function LogoutButton() {
  const { signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    if (isLoading) return;
    setIsLoading(true);
    
    try {
      await signOut();
    } catch (err) {
      console.error('Logout error:', err);
      setIsLoading(false);
    }
  };

  return (
    <Button variant="ghost" onClick={handleLogout} disabled={isLoading}>
      <LogOut className="h-4 w-4 mr-2" />
      {isLoading ? "Signing out..." : "Sign Out"}
    </Button>
  );
}
