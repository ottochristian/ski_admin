"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface BulkRaceRegistrationFormProps {
  raceId: string;
  athletes: any[];
  registeredAthleteIds: string[];
}

export function BulkRaceRegistrationForm({
  raceId,
  athletes,
  registeredAthleteIds,
}: BulkRaceRegistrationFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([]);

  const toggleAthlete = (athleteId: string) => {
    setSelectedAthletes((prev) =>
      prev.includes(athleteId)
        ? prev.filter((id) => id !== athleteId)
        : [...prev, athleteId]
    );
  };

  const selectAll = () => {
    const unregisteredIds = athletes
      .filter(a => !registeredAthleteIds.includes(a.id))
      .map(a => a.id);
    setSelectedAthletes(unregisteredIds);
  };

  const clearAll = () => {
    setSelectedAthletes([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();

    try {
      // Create race registrations
      const registrations = selectedAthletes.map((athleteId) => ({
        race_id: raceId,
        athlete_id: athleteId,
        status: "registered",
      }));

      const { error: insertError } = await supabase
        .from("race_registrations")
        .insert(registrations);

      if (insertError) throw insertError;

      // TODO: In production, this would call the Zone4 API
      // to submit the registrations
      console.log("[v0] Zone4 integration: Would submit", selectedAthletes.length, "athletes to Zone4");

      router.push("/coach/races");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const unregisteredAthletes = athletes.filter(
    (a) => !registeredAthleteIds.includes(a.id)
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {unregisteredAthletes.length > 0 ? (
        <>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={clearAll}>
              Clear All
            </Button>
            <div className="ml-auto text-sm text-muted-foreground">
              {selectedAthletes.length} selected
            </div>
          </div>

          <div className="space-y-2">
            {unregisteredAthletes.map((athlete) => (
              <Card key={athlete.id} className="cursor-pointer hover:bg-slate-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      id={athlete.id}
                      checked={selectedAthletes.includes(athlete.id)}
                      onCheckedChange={() => toggleAthlete(athlete.id)}
                    />
                    <label
                      htmlFor={athlete.id}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">
                            {athlete.first_name} {athlete.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {athlete.families?.family_name}
                          </p>
                          {athlete.ussa_number && (
                            <p className="text-xs text-muted-foreground">
                              USSA: {athlete.ussa_number}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {athlete.registrations?.slice(0, 2).map((reg: any) => (
                            <Badge key={reg.id} variant="secondary" className="text-xs">
                              {reg.sub_programs?.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </label>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || selectedAthletes.length === 0}
          >
            {isLoading
              ? "Registering..."
              : `Register ${selectedAthletes.length} Athlete${selectedAthletes.length !== 1 ? "s" : ""}`}
          </Button>
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          All eligible athletes are already registered for this race.
        </div>
      )}
    </form>
  );
}
