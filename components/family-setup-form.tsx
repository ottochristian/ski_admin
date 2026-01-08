"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface FamilySetupFormProps {
  userId: string;
  clubId: string;
}

export function FamilySetupForm({ userId, clubId }: FamilySetupFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    familyName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zipCode: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();

    try {
      // 1. Get user's email from profile for primary_email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single()

      if (!profile) {
        throw new Error('Profile not found')
      }

      // 2. Create household
      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .insert({
          club_id: clubId,
          primary_email: profile.email,
          address_line1: formData.addressLine1,
          address_line2: formData.addressLine2 || null,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zipCode,
          emergency_contact_name: formData.emergencyContactName,
          emergency_contact_phone: formData.emergencyContactPhone,
        })
        .select()
        .single()

      if (householdError) throw householdError

      // 3. Link user to household via household_guardians
      const { error: guardianError } = await supabase
        .from('household_guardians')
        .insert({
          household_id: householdData.id,
          user_id: userId,
          is_primary: true,
        })

      if (guardianError) throw guardianError

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
      <div className="space-y-2">
        <Label htmlFor="familyName">Household Name (Optional)</Label>
        <Input
          id="familyName"
          value={formData.familyName}
          onChange={(e) => setFormData({ ...formData, familyName: e.target.value })}
          placeholder="The Smith Family"
        />
        <p className="text-xs text-muted-foreground">
          This is optional and for your reference only.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900">Address</h3>
        <div className="space-y-2">
          <Label htmlFor="addressLine1">Street Address</Label>
          <Input
            id="addressLine1"
            required
            value={formData.addressLine1}
            onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="addressLine2">Apartment, suite, etc. (optional)</Label>
          <Input
            id="addressLine2"
            value={formData.addressLine2}
            onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              required
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              required
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              placeholder="CO"
              maxLength={2}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="zipCode">ZIP Code</Label>
          <Input
            id="zipCode"
            required
            value={formData.zipCode}
            onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
            placeholder="80401"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900">Emergency Contact</h3>
        <div className="space-y-2">
          <Label htmlFor="emergencyContactName">Name</Label>
          <Input
            id="emergencyContactName"
            required
            value={formData.emergencyContactName}
            onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="emergencyContactPhone">Phone Number</Label>
          <Input
            id="emergencyContactPhone"
            type="tel"
            required
            value={formData.emergencyContactPhone}
            onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
            placeholder="(555) 123-4567"
          />
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Saving..." : "Complete Setup"}
      </Button>
    </form>
  );
}
