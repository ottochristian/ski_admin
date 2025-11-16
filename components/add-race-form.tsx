"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AddRaceForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    raceDate: "",
    location: "",
    zone4RaceId: "",
    discipline: "",
    description: "",
    registrationDeadline: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();

    try {
      const { error } = await supabase.from("races").insert({
        name: formData.name,
        race_date: formData.raceDate,
        location: formData.location || null,
        zone4_race_id: formData.zone4RaceId || null,
        discipline: formData.discipline || null,
        description: formData.description || null,
        registration_deadline: formData.registrationDeadline || null,
      });

      if (error) throw error;

      // TODO: In production, this would call Zone4 API to fetch race details
      if (formData.zone4RaceId) {
        console.log("[v0] Zone4 integration: Would fetch race details from Zone4 for ID:", formData.zone4RaceId);
      }

      router.push("/admin");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Race Name</Label>
        <Input
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Giant Slalom Championship"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="raceDate">Race Date</Label>
          <Input
            id="raceDate"
            type="date"
            required
            value={formData.raceDate}
            onChange={(e) => setFormData({ ...formData, raceDate: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="registrationDeadline">Registration Deadline</Label>
          <Input
            id="registrationDeadline"
            type="date"
            value={formData.registrationDeadline}
            onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          placeholder="Copper Mountain, CO"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="discipline">Discipline</Label>
        <Select value={formData.discipline} onValueChange={(value) => setFormData({ ...formData, discipline: value })}>
          <SelectTrigger id="discipline">
            <SelectValue placeholder="Select discipline" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alpine">Alpine</SelectItem>
            <SelectItem value="nordic">Nordic</SelectItem>
            <SelectItem value="freeride">Freeride</SelectItem>
            <SelectItem value="snowboard">Snowboard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="zone4RaceId">Zone4 Race ID (Optional)</Label>
        <Input
          id="zone4RaceId"
          value={formData.zone4RaceId}
          onChange={(e) => setFormData({ ...formData, zone4RaceId: e.target.value })}
          placeholder="Enter Zone4 race ID for automatic sync"
        />
        <p className="text-xs text-slate-500">
          Link this race to Zone4 for automatic registration submission and result syncing
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Additional race information..."
          rows={4}
        />
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Creating Race..." : "Create Race"}
      </Button>
    </form>
  );
}
