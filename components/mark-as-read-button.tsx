"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Check } from 'lucide-react';

interface MarkAsReadButtonProps {
  recipientId: string;
}

export function MarkAsReadButton({ recipientId }: MarkAsReadButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleMarkAsRead = async () => {
    setIsLoading(true);
    const supabase = createClient();

    try {
      await supabase
        .from("message_recipients")
        .update({ read_at: new Date().toISOString() })
        .eq("id", recipientId);

      router.refresh();
    } catch (error) {
      console.error("Failed to mark as read:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleMarkAsRead} disabled={isLoading}>
      <Check className="h-4 w-4 mr-2" />
      {isLoading ? "Marking as read..." : "Mark as Read"}
    </Button>
  );
}
