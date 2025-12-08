"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AddAthleteFormProps {
  familyId: string;
}

export function AddAthleteForm({ familyId }: AddAthleteFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    ussaNumber: "",
    fisLicense: "",
    medicalNotes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();

    try {
      const { error } = await supabase.from("athletes").insert({
        family_id: familyId,
        first_name: formData.firstName,
        last_name: formData.lastName,
        date_of_birth: formData.dateOfBirth,
        gender: formData.gender || null,
        ussa_number: formData.ussaNumber || null,
        fis_license: formData.fisLicense || null,
        medical_notes: formData.medicalNotes || null,
      });

      if (error) throw error;

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            required
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            required
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Date of Birth</Label>
          <Input
            id="dateOfBirth"
            type="date"
            required
            value={formData.dateOfBirth}
            onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
            <SelectTrigger id="gender">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ussaNumber">USSA Number (Optional)</Label>
          <Input
            id="ussaNumber"
            value={formData.ussaNumber}
            onChange={(e) => setFormData({ ...formData, ussaNumber: e.target.value })}
            placeholder="123456"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fisLicense">FIS License (Optional)</Label>
          <Input
            id="fisLicense"
            value={formData.fisLicense}
            onChange={(e) => setFormData({ ...formData, fisLicense: e.target.value })}
            placeholder="FIS123456"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="medicalNotes">Medical Notes (Optional)</Label>
        <Textarea
          id="medicalNotes"
          value={formData.medicalNotes}
          onChange={(e) => setFormData({ ...formData, medicalNotes: e.target.value })}
          placeholder="Allergies, medications, or other important medical information..."
          rows={4}
        />
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Adding Athlete..." : "Add Athlete"}
      </Button>
    </form>
  );
}
