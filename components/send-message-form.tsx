"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface SendMessageFormProps {
  userId: string;
  programs: any[];
}

export function SendMessageForm({ userId, programs }: SendMessageFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [targetType, setTargetType] = useState<"program" | "sub_program" | "group">("program");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedSubProgram, setSelectedSubProgram] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Get sub-programs for selected program
  const subPrograms = programs.find(p => p.id === selectedProgram)?.sub_programs || [];
  
  // Get groups for selected sub-program
  const groups = subPrograms.find((sp: any) => sp.id === selectedSubProgram)?.groups || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();

    try {
      // Insert message
      const { data: message, error: messageError } = await supabase
        .from("messages")
        .insert({
          sender_id: userId,
          subject,
          body,
          program_id: targetType === "program" ? selectedProgram : null,
          sub_program_id: targetType === "sub_program" ? selectedSubProgram : null,
          group_id: targetType === "group" ? selectedGroup : null,
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Get recipients based on target
      let recipientsQuery = supabase
        .from("families")
        .select("profile_id");

      if (targetType === "group") {
        // Get families with athletes in this group
        const { data: registrations } = await supabase
          .from("registrations")
          .select("athletes(family_id)")
          .eq("group_id", selectedGroup);
        
        const familyIds = [...new Set(registrations?.map((r: any) => r.athletes?.family_id).filter(Boolean))];
        recipientsQuery = recipientsQuery.in("id", familyIds);
      } else if (targetType === "sub_program") {
        // Get families with athletes in this sub-program
        const { data: registrations } = await supabase
          .from("registrations")
          .select("athletes(family_id)")
          .eq("sub_program_id", selectedSubProgram);
        
        const familyIds = [...new Set(registrations?.map((r: any) => r.athletes?.family_id).filter(Boolean))];
        recipientsQuery = recipientsQuery.in("id", familyIds);
      } else if (targetType === "program") {
        // Get families with athletes in any sub-program of this program
        const { data: subPrograms } = await supabase
          .from("sub_programs")
          .select("id")
          .eq("program_id", selectedProgram);
        
        const subProgramIds = subPrograms?.map(sp => sp.id) || [];
        
        const { data: registrations } = await supabase
          .from("registrations")
          .select("athletes(family_id)")
          .in("sub_program_id", subProgramIds);
        
        const familyIds = [...new Set(registrations?.map((r: any) => r.athletes?.family_id).filter(Boolean))];
        recipientsQuery = recipientsQuery.in("id", familyIds);
      }

      const { data: families } = await recipientsQuery;

      // Insert message recipients
      if (families && families.length > 0) {
        const recipients = families.map((family: any) => ({
          message_id: message.id,
          recipient_id: family.profile_id,
        }));

        const { error: recipientsError } = await supabase
          .from("message_recipients")
          .insert(recipients);

        if (recipientsError) throw recipientsError;
      }

      router.push("/coach/messages");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <Label>Send to</Label>
        <RadioGroup value={targetType} onValueChange={(value: any) => setTargetType(value)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="program" id="program" />
            <Label htmlFor="program" className="font-normal cursor-pointer">
              Entire Program
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="sub_program" id="sub_program" />
            <Label htmlFor="sub_program" className="font-normal cursor-pointer">
              Sub-Program
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="group" id="group" />
            <Label htmlFor="group" className="font-normal cursor-pointer">
              Specific Group
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="program">Program</Label>
        <Select value={selectedProgram} onValueChange={setSelectedProgram} required>
          <SelectTrigger id="program">
            <SelectValue placeholder="Select program" />
          </SelectTrigger>
          <SelectContent>
            {programs.map((program) => (
              <SelectItem key={program.id} value={program.id}>
                {program.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(targetType === "sub_program" || targetType === "group") && selectedProgram && (
        <div className="space-y-2">
          <Label htmlFor="subProgram">Sub-Program</Label>
          <Select value={selectedSubProgram} onValueChange={setSelectedSubProgram} required>
            <SelectTrigger id="subProgram">
              <SelectValue placeholder="Select sub-program" />
            </SelectTrigger>
            <SelectContent>
              {subPrograms.map((sp: any) => (
                <SelectItem key={sp.id} value={sp.id}>
                  {sp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {targetType === "group" && selectedSubProgram && (
        <div className="space-y-2">
          <Label htmlFor="group">Group</Label>
          <Select value={selectedGroup} onValueChange={setSelectedGroup} required>
            <SelectTrigger id="group">
              <SelectValue placeholder="Select group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g: any) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Practice schedule update"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Message</Label>
        <Textarea
          id="body"
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type your message here..."
          rows={8}
        />
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Sending..." : "Send Message"}
      </Button>
    </form>
  );
}
