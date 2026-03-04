"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabaseClient";

type Program = {
  id: string;
  name: string;
  description: string;
};

type Cohort = {
  id: string;
  program_id: string;
  name: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
};

type User = {
  id: string;
  email: string;
  name: string;
  cohort?: string;
};

export default function CMSDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const locale = useLocale();

  const [mounted, setMounted] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Program State
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [isEditingProgram, setIsEditingProgram] = useState(false);
  const [newProgramName, setNewProgramName] = useState("");
  const [newProgramDesc, setNewProgramDesc] = useState("");
  const [editProgramName, setEditProgramName] = useState("");
  const [editProgramDesc, setEditProgramDesc] = useState("");
  const [showProgramDeleteModal, setShowProgramDeleteModal] = useState(false);
  const [programDeleteConfirmText, setProgramDeleteConfirmText] = useState("");

  // Cohort State
  const [cohorts, setCohorts] = useState<Cohort[]>([]); // Filtered for selectedProgram
  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);
  const [isEditingCohort, setIsEditingCohort] = useState(false);
  const [newCohortName, setNewCohortName] = useState("");
  const [newCohortDesc, setNewCohortDesc] = useState("");
  const [newCohortStartDate, setNewCohortStartDate] = useState("");
  const [newCohortEndDate, setNewCohortEndDate] = useState("");
  const [editCohortName, setEditCohortName] = useState("");
  const [editCohortDesc, setEditCohortDesc] = useState("");
  const [editCohortStartDate, setEditCohortStartDate] = useState("");
  const [editCohortEndDate, setEditCohortEndDate] = useState("");
  const [showCohortDeleteModal, setShowCohortDeleteModal] = useState(false);
  const [cohortDeleteConfirmText, setCohortDeleteConfirmText] = useState("");

  // Membership State
  const [students, setStudents] = useState<User[]>([]);
  const [cohortMembers, setCohortMembers] = useState<User[]>([]);
  const [instructors, setInstructors] = useState<User[]>([]);
  const [cohortInstructors, setCohortInstructors] = useState<User[]>([]);

  // Assignment State
  const [programAssignments, setProgramAssignments] = useState<string[]>([]);
  const [allMissions, setAllMissions] = useState<any[]>([]);
  const [processingUsers, setProcessingUsers] = useState<Set<string>>(new Set());
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");

  // Initial Data Load with Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/");
        return;
      }

      const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
      const role = userData?.role || "student";

      if (role === 'student') {
        router.push(`/${locale}/dashboard`);
        return;
      }

      setUserRole(role);
      setMounted(true);

      fetchPrograms();
      fetchStudents();
      fetchInstructors();
      fetchMissions();
    };
    checkAuth();
  }, []);

  // Fetch Cohorts when Program changes
  useEffect(() => {
    if (selectedProgram) {
      fetchCohortsForProgram(selectedProgram.id);
      fetchProgramAssignments(selectedProgram.id);
      setSelectedCohort(null); // Reset cohort selection
    } else {
      setCohorts([]);
      setProgramAssignments([]);
    }
  }, [selectedProgram]);

  // Fetch Members when Cohort changes
  useEffect(() => {
    if (selectedCohort) {
      fetchCohortMembers(selectedCohort.id);
      fetchCohortInstructors(selectedCohort.id);
    } else {
      setCohortMembers([]);
      setCohortInstructors([]);
    }
  }, [selectedCohort]);

  /* ====================== FETCHING ====================== */
  const fetchPrograms = async () => {
    const { data } = await supabase.from("programs").select("*").order('created_at', { ascending: false });
    if (data) setPrograms(data);
  };

  const fetchCohortsForProgram = async (programId: string) => {
    const { data } = await supabase.from("cohorts").select("*").eq('program_id', programId).order('created_at', { ascending: true });
    if (data) setCohorts(data);
  };

  const fetchStudents = async () => {
    const { data } = await supabase.from("users").select("*").in("role", ["student"]);
    if (data) setStudents(data);
  };

  const fetchInstructors = async () => {
    const { data } = await supabase.from("users").select("*").in("role", ["staff", "admin", "superuser", "lecturer"]);
    if (data) setInstructors(data);
  };

  const fetchCohortMembers = async (cohortId: string) => {
    const { data } = await supabase.from("cohort_memberships").select("users (id, email, name)").eq("cohort_id", cohortId);
    if (data) setCohortMembers(data.map((row: any) => row.users).filter(Boolean));
  };

  const fetchCohortInstructors = async (cohortId: string) => {
    const { data } = await supabase.from("cohort_instructors").select("users (id, email, name)").eq("cohort_id", cohortId);
    if (data) setCohortInstructors(data.map((row: any) => row.users).filter(Boolean));
  };

  const fetchProgramAssignments = async (programId: string) => {
    const { data } = await supabase.from("program_assignments").select("mission_id").eq("program_id", programId);
    if (data) setProgramAssignments(data.map((row: any) => row.mission_id));
  };

  const fetchMissions = async () => {
    const { data } = await supabase.from("missions").select("*").order('created_at', { ascending: false });
    if (data) setAllMissions(data);
  };

  /* ====================== PROGRAM CRUD ====================== */
  const handleSelectProgram = (p: Program) => {
    setSelectedProgram(p);
    setIsEditingProgram(false);
    setEditProgramName(p.name || "");
    setEditProgramDesc(p.description || "");
  };

  const handleCreateProgram = async () => {
    if (!newProgramName) return;
    const { data, error } = await supabase.from("programs").insert([{ name: newProgramName, description: newProgramDesc }]).select().single();
    setNewProgramName("");
    setNewProgramDesc("");
    await fetchPrograms();
    if (data) handleSelectProgram(data);
  };

  const handleUpdateProgram = async () => {
    if (!selectedProgram || !editProgramName) return;
    await supabase.from("programs").update({ name: editProgramName, description: editProgramDesc }).eq('id', selectedProgram.id);
    setIsEditingProgram(false);
    fetchPrograms();
    setSelectedProgram({ ...selectedProgram, name: editProgramName, description: editProgramDesc });
  };

  const handleDeleteProgram = async () => {
    if (!selectedProgram || programDeleteConfirmText !== selectedProgram.name) return;

    // Reset all enrolled students' cohort/cohort_id for all cohorts in this program
    const { data: programCohorts } = await supabase.from("cohorts").select("id").eq("program_id", selectedProgram.id);
    if (programCohorts && programCohorts.length > 0) {
      const cohortIds = programCohorts.map(c => c.id);
      const { data: allMembers } = await supabase.from("cohort_memberships").select("user_id").in("cohort_id", cohortIds);
      if (allMembers && allMembers.length > 0) {
        const userIds = [...new Set(allMembers.map(m => m.user_id))];
        await supabase.from("users").update({ cohort: 'DEFAULT', cohort_id: null }).in("id", userIds);
      }
    }

    await supabase.from("programs").delete().eq('id', selectedProgram.id);
    setSelectedProgram(null);
    setShowProgramDeleteModal(false);
    setProgramDeleteConfirmText("");
    fetchPrograms();
  };

  /* ====================== ASSIGNMENTS CRUD ====================== */
  const handleAssignMission = async (missionId: string) => {
    if (!selectedProgram) return;
    await supabase.from("program_assignments").upsert(
      { program_id: selectedProgram.id, mission_id: missionId },
      { onConflict: 'program_id,mission_id', ignoreDuplicates: true }
    );
    fetchProgramAssignments(selectedProgram.id);
  };

  const handleRevokeMission = async (missionId: string) => {
    if (!selectedProgram) return;
    await supabase.from("program_assignments").delete().match({ program_id: selectedProgram.id, mission_id: missionId });
    fetchProgramAssignments(selectedProgram.id);
  };

  /* ====================== COHORT CRUD ====================== */
  const handleSelectCohort = (c: Cohort) => {
    setSelectedCohort(c);
    setIsEditingCohort(false);
    setEditCohortName(c.name || "");
    setEditCohortDesc(c.description || "");
    setEditCohortStartDate(c.start_date || "");
    setEditCohortEndDate(c.end_date || "");
  };

  const handleCreateCohort = async () => {
    if (!selectedProgram || !newCohortName) return;
    const { data } = await supabase.from("cohorts").insert([{
      program_id: selectedProgram.id,
      name: newCohortName,
      description: newCohortDesc,
      start_date: newCohortStartDate || null,
      end_date: newCohortEndDate || null
    }]).select().single();

    setNewCohortName(""); setNewCohortDesc(""); setNewCohortStartDate(""); setNewCohortEndDate("");
    await fetchCohortsForProgram(selectedProgram.id);
    if (data) handleSelectCohort(data);
  };

  const handleUpdateCohort = async () => {
    if (!selectedCohort || !editCohortName) return;
    const updates = {
      name: editCohortName,
      description: editCohortDesc,
      start_date: editCohortStartDate || null,
      end_date: editCohortEndDate || null
    };
    await supabase.from("cohorts").update(updates).eq('id', selectedCohort.id);
    setIsEditingCohort(false);
    fetchCohortsForProgram(selectedCohort.program_id);
    setSelectedCohort({ ...selectedCohort, ...updates });
  };

  const handleDeleteCohort = async () => {
    if (!selectedCohort || cohortDeleteConfirmText !== selectedCohort.name) return;

    // Reset enrolled students' cohort/cohort_id before deleting
    const { data: members } = await supabase.from("cohort_memberships").select("user_id").eq("cohort_id", selectedCohort.id);
    if (members && members.length > 0) {
      const userIds = members.map(m => m.user_id);
      await supabase.from("users").update({ cohort: 'DEFAULT', cohort_id: null }).in("id", userIds);
    }

    await supabase.from("cohorts").delete().eq('id', selectedCohort.id);
    const parentId = selectedCohort.program_id;
    setSelectedCohort(null);
    setShowCohortDeleteModal(false);
    setCohortDeleteConfirmText("");
    fetchCohortsForProgram(parentId);
  };

  /* ====================== MEMBERSHIP ====================== */
  const handleAddStudentToCohort = async (userId: string) => {
    if (!selectedCohort) return;
    setProcessingUsers(prev => new Set(prev).add(userId));
    try {
      const { error: memberError } = await supabase.from("cohort_memberships").upsert({ cohort_id: selectedCohort.id, user_id: userId }, { onConflict: 'cohort_id,user_id', ignoreDuplicates: true });
      if (memberError) {
        console.error("Enrollment error:", memberError);
        alert(`Enrollment failed: ${memberError.message}`);
        return;
      }

      // Sync to users table for dashboard display
      const { error: userError } = await supabase.from("users").update({
        cohort: selectedCohort.name,
        cohort_id: selectedCohort.id
      }).eq("id", userId);
      if (userError) {
        console.error("User sync error:", userError);
        alert(`Sync to user profile failed: ${JSON.stringify(userError)}\nThis may be an RLS policy issue.`);
        return;
      }

      await fetchCohortMembers(selectedCohort.id);
      await fetchStudents();
    } finally {
      setProcessingUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleRemoveStudentFromCohort = async (userId: string) => {
    if (!selectedCohort) return;
    setProcessingUsers(prev => new Set(prev).add(userId));
    try {
      const { error: memberError } = await supabase.from("cohort_memberships").delete().match({ cohort_id: selectedCohort.id, user_id: userId });
      if (memberError) {
        console.error("Removal error:", memberError);
        alert(`Removal failed: ${memberError.message}`);
        return;
      }

      // Sync to users table (reset to DEFAULT)
      const { error: userError } = await supabase.from("users").update({
        cohort: 'DEFAULT',
        cohort_id: null
      }).eq("id", userId);
      if (userError) {
        console.error("User sync error:", userError);
        alert(`Sync to user profile update failed: ${JSON.stringify(userError)}`);
        return;
      }

      await fetchCohortMembers(selectedCohort.id);
      await fetchStudents();
    } finally {
      setProcessingUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleAddInstructor = async (userId: string) => {
    if (!selectedCohort) return;
    setProcessingUsers(prev => new Set(prev).add(userId));
    try {
      await supabase.from("cohort_instructors").upsert({ cohort_id: selectedCohort.id, user_id: userId }, { onConflict: 'cohort_id,user_id', ignoreDuplicates: true });
      await fetchCohortInstructors(selectedCohort.id);
    } finally {
      setProcessingUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleRemoveInstructor = async (userId: string) => {
    if (!selectedCohort) return;
    setProcessingUsers(prev => new Set(prev).add(userId));
    try {
      await supabase.from("cohort_instructors").delete().match({ cohort_id: selectedCohort.id, user_id: userId });
      await fetchCohortInstructors(selectedCohort.id);
    } finally {
      setProcessingUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  if (!mounted || userRole === 'student') return <div className="min-h-screen bg-black flex items-center justify-center font-sans tracking-widest text-emerald-500 uppercase font-black animate-pulse text-2xl">Initializing...</div>;

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-8 text-white">
      <h1 className="text-3xl font-bold mb-8">Micro-degree CMS</h1>

      <div className="flex flex-col lg:flex-row gap-8 items-start">

        {/* ==================== LEFT PANEL: PROGRAMS ==================== */}
        <div className="w-full lg:w-1/3 bg-[var(--color-card)] p-6 rounded-xl border border-[var(--color-card-border)] flex-shrink-0">
          <h2 className="text-xl font-semibold mb-4 text-[var(--color-primary)]">Programs (Macros)</h2>
          <div className="space-y-3 mb-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {programs.length === 0 && <p className="text-sm text-gray-500">No programs exist yet.</p>}
            {programs.map((p) => (
              <div
                key={p.id}
                onClick={() => handleSelectProgram(p)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedProgram?.id === p.id ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 shadow-[0_0_10px_rgba(var(--color-accent-rgb),0.2)]" : "border-[var(--color-card-border)] hover:border-gray-500"}`}
              >
                <div className="font-bold text-lg text-white">{p.name}</div>
                <div className="text-xs text-gray-400 mt-1 line-clamp-2">{p.description}</div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-[var(--color-card-border)] bg-black/20 p-4 rounded-lg mt-4">
            <h3 className="text-sm font-semibold mb-3 text-gray-300">+ Create New Program</h3>
            <input
              type="text"
              placeholder="Program Name (e.g. 의대 실습 2026)"
              value={newProgramName}
              onChange={(e) => setNewProgramName(e.target.value)}
              className="w-full bg-black/50 border border-[var(--color-card-border)] rounded-md px-3 py-2 mb-2 text-sm focus:border-[var(--color-primary)] outline-none"
            />
            <input
              type="text"
              placeholder="Description (Optional)"
              value={newProgramDesc}
              onChange={(e) => setNewProgramDesc(e.target.value)}
              className="w-full bg-black/50 border border-[var(--color-card-border)] rounded-md px-3 py-2 mb-3 text-sm focus:border-[var(--color-primary)] outline-none"
            />
            <button
              onClick={handleCreateProgram}
              disabled={!newProgramName}
              className="w-full bg-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/40 text-[var(--color-primary)] py-2 rounded-md transition-colors disabled:opacity-50 text-sm font-bold"
            >
              Create Program
            </button>
          </div>
        </div>

        {/* ==================== RIGHT PANEL: DETAILS ==================== */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">

          {!selectedProgram && (
            <div className="bg-[var(--color-card)]/50 p-12 rounded-xl border border-[var(--color-card-border)] border-dashed text-center flex flex-col items-center justify-center animate-pulse">
              <span className="text-4xl mb-4">📚</span>
              <h3 className="text-xl text-gray-400 font-medium">Select a Program from the left menu</h3>
              <p className="text-sm text-gray-500 mt-2">Manage cohorts, missions, and students for the selected Micro-degree.</p>
            </div>
          )}

          {/* PROGRAM DASHBOARD */}
          {selectedProgram && (
            <div className="bg-[var(--color-card)] p-6 rounded-xl border border-[var(--color-accent)]/30 relative shadow-lg">
              <div className="absolute top-0 right-0 p-4 flex gap-2">
                {!isEditingProgram && (
                  <>
                    <button onClick={() => setIsEditingProgram(true)} className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded transition-colors text-gray-300">Edit Program</button>
                    <button onClick={() => { setProgramDeleteConfirmText(""); setShowProgramDeleteModal(true) }} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded transition-colors">Delete</button>
                  </>
                )}
              </div>

              {isEditingProgram ? (
                <div className="mb-4 pr-32">
                  <input type="text" value={editProgramName} onChange={e => setEditProgramName(e.target.value)} className="w-full bg-black/50 border border-[var(--color-card-border)] rounded-md px-3 py-2 mb-2 text-2xl font-bold text-[var(--color-accent)] focus:outline-none focus:border-[var(--color-primary)]" />
                  <textarea value={editProgramDesc} onChange={e => setEditProgramDesc(e.target.value)} rows={2} className="w-full bg-black/50 border border-[var(--color-card-border)] rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-[var(--color-primary)]" />
                  <div className="flex gap-2 mt-3">
                    <button onClick={handleUpdateProgram} className="bg-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded text-sm transition-colors font-medium">Save</button>
                    <button onClick={() => setIsEditingProgram(false)} className="bg-gray-500/20 text-gray-400 px-4 py-1.5 rounded text-sm transition-colors font-medium">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="mb-6 pr-32">
                  <h2 className="text-3xl font-extrabold text-[var(--color-accent)] mb-2">{selectedProgram.name}</h2>
                  <p className="text-gray-300 leading-relaxed text-sm">{selectedProgram.description || "No description provided."}</p>
                </div>
              )}

              {/* MODULE ASSIGNMENTS */}
              <div className="mt-8 pt-6 border-t border-[var(--color-card-border)]">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><span className="text-[var(--color-accent)] text-xl">📦</span> Modular Blueprint (Program Modules)</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-black/30 p-4 rounded-xl border border-[var(--color-card-border)]/50">
                  {/* Assigned Modules */}
                  <div>
                    <h4 className="text-xs uppercase tracking-wider font-bold text-[var(--color-accent)] mb-3">Assigned to Program ({programAssignments.length})</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                      {programAssignments.length === 0 && <span className="text-xs text-gray-500 italic">No modules assigned yet.</span>}
                      {programAssignments.map(mId => {
                        const mockMission = allMissions.find(m => m.id === mId);
                        if (!mockMission) return null;
                        return (
                          <div key={mId} className="flex justify-between items-center bg-[var(--color-card)] border border-[var(--color-accent)]/30 p-2 rounded-md">
                            <div>
                              <div className="text-xs font-bold text-white">{mockMission.title}</div>
                              <div className="text-[10px] text-gray-400">Era: {mockMission.era}</div>
                            </div>
                            <button onClick={() => handleRevokeMission(mId)} className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 px-2 py-1 rounded">REVOKE</button>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Available Modules */}
                  <div>
                    <h4 className="text-xs uppercase tracking-wider font-bold text-gray-400 mb-3">Available Modules Gallery</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                      {allMissions.map(mission => {
                        if (programAssignments.includes(mission.id)) return null;
                        return (
                          <div key={mission.id} className="flex justify-between items-center bg-black/50 border border-[var(--color-card-border)] p-2 rounded-md">
                            <div>
                              <div className="text-xs font-bold text-gray-300">{mission.title}</div>
                              <div className="text-[10px] text-gray-500">Era: {mission.era}</div>
                            </div>
                            <button onClick={() => handleAssignMission(mission.id)} className="text-[10px] font-bold text-[var(--color-accent)] hover:text-white bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/30 px-2 py-1 rounded">ASSIGN</button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* COHORTS LIST UNDER PROGRAM */}
              <div className="mt-8 pt-6 border-t border-[var(--color-card-border)]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2"><span className="text-[var(--color-primary)] text-xl">👥</span> Cohorts (Instances)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {cohorts.map(c => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCohort(c)}
                      className={`p-4 rounded-xl border cursor-pointer hover:-translate-y-1 transition-all duration-200 ${selectedCohort?.id === c.id ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 shadow-lg" : "border-[var(--color-card-border)] bg-black/20"}`}
                    >
                      <div className="font-bold text-[var(--color-primary)]">{c.name}</div>
                      {(c.start_date || c.end_date) && (
                        <div className="text-xs text-gray-400 mt-1 font-mono">
                          📅 {c.start_date || "TBD"} ~ {c.end_date || "TBD"}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* CREATE COHORT CARD */}
                  <div className="p-4 rounded-xl border border-dashed border-[var(--color-card-border)] bg-black/10 flex flex-col justify-center">
                    <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase">Create New Cohort</h4>
                    <input type="text" placeholder="Cohort Name (e.g. 1기)" value={newCohortName} onChange={e => setNewCohortName(e.target.value)} className="w-full bg-black/50 border border-[var(--color-card-border)] rounded text-xs px-2 py-1.5 mb-2 focus:border-[var(--color-primary)] outline-none" />
                    <div className="flex gap-2 mb-2">
                      <input type="date" value={newCohortStartDate} onChange={e => setNewCohortStartDate(e.target.value)} className="w-1/2 bg-black/50 border border-[var(--color-card-border)] rounded text-[10px] px-2 py-1 text-gray-300" />
                      <input type="date" value={newCohortEndDate} onChange={e => setNewCohortEndDate(e.target.value)} className="w-1/2 bg-black/50 border border-[var(--color-card-border)] rounded text-[10px] px-2 py-1 text-gray-300" />
                    </div>
                    <button onClick={handleCreateCohort} disabled={!newCohortName} className="w-full bg-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/40 text-[var(--color-primary)] py-1.5 rounded text-xs transition-colors font-bold mt-auto">Add</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MANAGER MEMBERS FOR SELECTED COHORT */}
          {selectedCohort && selectedProgram && (
            <div className="bg-[var(--color-card)] p-6 rounded-xl border border-[var(--color-card-border)] shadow-xl animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex justify-between items-start mb-6 border-b border-[var(--color-card-border)] pb-4">
                {isEditingCohort ? (
                  <div className="flex-grow mr-4">
                    <input type="text" value={editCohortName} onChange={e => setEditCohortName(e.target.value)} className="w-full max-w-xs bg-black/50 border border-[var(--color-card-border)] rounded-md px-3 py-1 mb-2 text-xl font-bold text-[var(--color-primary)] focus:outline-none" />
                    <div className="flex gap-3 mb-3">
                      <div className="flex items-center gap-2 text-xs text-gray-400"><span className="w-12">Start:</span><input type="date" value={editCohortStartDate} onChange={e => setEditCohortStartDate(e.target.value)} className="bg-black/50 border border-[var(--color-card-border)] rounded px-2 py-1" /></div>
                      <div className="flex items-center gap-2 text-xs text-gray-400"><span className="w-12">End:</span><input type="date" value={editCohortEndDate} onChange={e => setEditCohortEndDate(e.target.value)} className="bg-black/50 border border-[var(--color-card-border)] rounded px-2 py-1" /></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleUpdateCohort} className="bg-emerald-500/20 text-emerald-400 py-1 px-4 rounded text-xs font-semibold">Save</button>
                      <button onClick={() => setIsEditingCohort(false)} className="bg-gray-500/20 text-gray-400 py-1 px-4 rounded text-xs font-semibold">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs text-[var(--color-accent)] font-bold mb-1 uppercase tracking-wider">{selectedProgram.name}</div>
                    <h3 className="text-2xl font-bold flex items-center gap-2 mb-2">
                      {selectedCohort.name}
                    </h3>
                    <div className="text-sm font-mono text-gray-400 flex items-center gap-4">
                      <span>📅 {selectedCohort.start_date || "No start date"} ~ {selectedCohort.end_date || "No end date"}</span>
                      <span className="text-emerald-400">👨‍🎓 {cohortMembers.length} Students</span>
                    </div>
                  </div>
                )}

                {!isEditingCohort && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setIsEditingCohort(true)} className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-gray-300">Edit Setup</button>
                    <button onClick={() => { setCohortDeleteConfirmText(""); setShowCohortDeleteModal(true) }} className="text-xs px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded">Delete Cohort</button>
                  </div>
                )}
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* STUDENTS BOX */}
                <div className="border border-[var(--color-card-border)] rounded-lg bg-black/20 overflow-hidden flex flex-col items-center justify-center p-8 h-[400px]">
                  <div className="bg-emerald-500/10 p-4 rounded-full mb-4">
                    <span className="text-4xl">👨‍🎓</span>
                  </div>
                  <h4 className="font-bold text-emerald-400 text-lg mb-2">Student Enrollment</h4>
                  <p className="text-gray-400 text-sm text-center mb-6">Manage enrolled students for this cohort. Currently {cohortMembers.length} students enrolled.</p>
                  <button
                    onClick={() => {
                      setStudentSearchQuery("");
                      setShowStudentModal(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-2"
                  >
                    Manage Students
                  </button>
                </div>

                {/* LECTURERS BOX */}
                <div className="border border-[var(--color-primary)]/30 rounded-lg bg-[var(--color-primary)]/5 overflow-hidden flex flex-col h-[400px]">
                  <div className="bg-black/40 px-4 py-3 border-b border-[var(--color-primary)]/30 flex justify-between items-center">
                    <h4 className="font-bold text-[var(--color-primary)] text-sm">Assigned Lecturers</h4>
                    <span className="text-xs bg-[var(--color-primary)]/20 text-[var(--color-primary)] px-2 py-0.5 rounded-full">{cohortInstructors.length}</span>
                  </div>
                  <div className="p-4 flex-grow overflow-y-auto custom-scrollbar">
                    {cohortInstructors.length === 0 && <div className="text-[var(--color-primary)]/60 text-xs italic text-center mt-4">No specific lecturers assigned.</div>}
                    <div className="space-y-2">
                      {cohortInstructors.map(m => {
                        if (!m) return null;
                        return (
                          <div key={m.id} className="flex justify-between items-center p-2 bg-black/50 border border-[var(--color-primary)]/20 rounded-md text-sm">
                            <div className="flex flex-col truncate pr-2">
                              <span className="font-medium text-[var(--color-primary)] truncate text-xs">{m.name || "Unknown"}</span>
                              <span className="text-[10px] text-[var(--color-primary)]/60 font-mono truncate">{m.email}</span>
                            </div>
                            <button
                              onClick={() => handleRemoveInstructor(m.id)}
                              disabled={processingUsers.has(m.id)}
                              className="text-[10px] text-red-400 hover:text-red-300 uppercase tracking-wider font-bold disabled:opacity-50"
                            >
                              {processingUsers.has(m.id) ? 'Saving...' : 'Remove'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="border-t border-[var(--color-primary)]/30 p-3 bg-black/40">
                    <div className="text-xs font-semibold text-gray-400 mb-2">Available Staff & Admins:</div>
                    <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1">
                      {instructors.map(s => {
                        if (cohortInstructors.some(m => m.id === s.id)) return null;
                        return (
                          <div key={s.id} className="flex justify-between items-center bg-black/30 border border-white/5 p-1.5 rounded">
                            <div className="flex flex-col truncate pr-2">
                              <span className="text-[10px] text-gray-200 truncate font-bold">{s.name || "Unknown"}</span>
                              <span className="text-[9px] text-gray-500 font-mono truncate">{s.email}</span>
                            </div>
                            <button
                              onClick={() => handleAddInstructor(s.id)}
                              disabled={processingUsers.has(s.id)}
                              className="text-[10px] text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-0.5 rounded hover:bg-[var(--color-primary)]/20 whitespace-nowrap disabled:opacity-50"
                            >
                              {processingUsers.has(s.id) ? '...' : 'Assign'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* DELETE PROGRAM MODAL */}
      {showProgramDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-[var(--color-card)] rounded-xl border border-red-500/50 p-8 max-w-lg w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
            <h3 className="text-2xl font-bold text-red-400 mb-4 flex items-center gap-2">⚠️ Delete Entire Program?</h3>
            <p className="text-gray-300 text-sm mb-4 leading-relaxed">
              You are about to delete <span className="font-bold text-white bg-red-500/20 px-1 rounded">{selectedProgram?.name}</span>.
              <br /><br />
              This is a <strong className="text-red-400">highly destructive action</strong>. It will permanently destroy this program, <strong>ALL</strong> nested cohorts, and every student's enrollment data inside those cohorts.
            </p>

            <div className="my-6 bg-black p-4 rounded-lg border border-red-500/30">
              <label className="text-xs text-red-400 mb-2 block font-semibold">Type "{selectedProgram?.name}" to confirm</label>
              <input
                type="text"
                value={programDeleteConfirmText}
                onChange={e => setProgramDeleteConfirmText(e.target.value)}
                className="w-full bg-transparent border-b border-red-500/50 py-2 text-white focus:outline-none focus:border-red-400 text-xl font-bold"
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowProgramDeleteModal(false)} className="px-5 py-2.5 text-sm font-semibold text-gray-300 hover:text-white bg-gray-600/30 hover:bg-gray-600/50 rounded-lg transition-colors">Cancel</button>
              <button
                onClick={handleDeleteProgram}
                disabled={programDeleteConfirmText !== selectedProgram?.name}
                className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all disabled:opacity-30 disabled:shadow-none"
              >
                Yes, Decimate Program
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE COHORT MODAL */}
      {showCohortDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-[var(--color-card)] rounded-xl border border-orange-500/50 p-6 max-w-md w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
            <h3 className="text-xl font-bold text-orange-400 mb-3">Delete Cohort?</h3>
            <p className="text-gray-300 text-sm mb-6">
              Are you sure you want to delete <span className="font-bold text-white">"{selectedCohort?.name}"</span>?
              All student enrollments and instructor assignments linked to this specific cohort will be removed. The parent program will not be affected.
            </p>

            <div className="mb-6">
              <input
                type="text"
                placeholder={`Type "${selectedCohort?.name}"`}
                value={cohortDeleteConfirmText}
                onChange={e => setCohortDeleteConfirmText(e.target.value)}
                className="w-full bg-black/50 border border-orange-500/30 rounded-md px-3 py-3 text-sm text-white focus:outline-none focus:border-orange-400 text-center font-bold"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCohortDeleteModal(false)} className="px-4 py-2 text-sm font-semibold text-gray-300 bg-gray-600/20 hover:bg-gray-600/40 rounded-lg transition-colors">Cancel</button>
              <button
                onClick={handleDeleteCohort}
                disabled={cohortDeleteConfirmText !== selectedCohort?.name}
                className="px-4 py-2 text-sm font-bold text-white bg-orange-600/80 hover:bg-orange-500 rounded-lg shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all disabled:opacity-30 disabled:shadow-none"
              >
                Delete Cohort
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT MANAGEMENT MODAL */}
      {showStudentModal && selectedCohort && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md px-4 py-10">
          <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-card-border)] w-full max-w-5xl h-full flex flex-col shadow-2xl relative overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-[var(--color-card-border)] bg-black/20 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                    <span className="bg-emerald-500/20 text-emerald-400 p-2 rounded-lg">👨‍🎓</span>
                    Manage Students: {selectedCohort.name}
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">{selectedProgram?.name} — Student Hub</p>
                </div>
                <button
                  onClick={() => setShowStudentModal(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-[var(--color-card-border)] rounded-xl px-12 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                  autoFocus
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Modal Content - Dual Lists */}
            <div className="flex-grow flex flex-col lg:flex-row overflow-hidden">
              {/* Enrolled Students (Left/Top) */}
              <div className="flex-1 border-r border-[var(--color-card-border)] flex flex-col overflow-hidden">
                <div className="px-6 py-3 bg-emerald-500/5 flex items-center justify-between border-b border-[var(--color-card-border)]">
                  <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400">Enrolled In Cohort</h4>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">{cohortMembers.length}</span>
                </div>
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar space-y-2">
                  {cohortMembers
                    .filter(m =>
                      !studentSearchQuery ||
                      m.name?.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                      m.email?.toLowerCase().includes(studentSearchQuery.toLowerCase())
                    )
                    .map(m => (
                      <div key={m.id} className="flex justify-between items-center p-3 bg-black/40 border border-emerald-500/20 rounded-xl group hover:border-emerald-500/40 transition-all">
                        <div className="flex flex-col truncate pr-4">
                          <span className="font-bold text-white text-sm truncate">{m.name || "Unknown User"}</span>
                          <span className="text-xs text-emerald-400/70 font-mono truncate">{m.email}</span>
                          <span className="text-[9px] text-gray-500 uppercase font-black tracking-tighter mt-1">Cohort: {students.find(s => s.id === m.id)?.cohort || '...'}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveStudentFromCohort(m.id)}
                          disabled={processingUsers.has(m.id)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 flex-shrink-0"
                        >
                          {processingUsers.has(m.id) ? 'Saving...' : 'Remove'}
                        </button>
                      </div>
                    ))}
                  {cohortMembers.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 p-8 text-center opacity-50">
                      <span className="text-3xl mb-2">🔭</span>
                      <p className="text-sm">No students in this cohort yet.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Available Database Students (Right/Bottom) */}
              <div className="flex-1 flex flex-col overflow-hidden bg-black/10">
                <div className="px-6 py-3 bg-gray-500/5 flex items-center justify-between border-b border-[var(--color-card-border)]">
                  <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Available Database Students</h4>
                  <span className="text-[10px] bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full font-bold">
                    {students.filter(s => !cohortMembers.some(m => m.id === s.id)).length}
                  </span>
                </div>
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar space-y-2">
                  {students
                    .filter(s => !cohortMembers.some(m => m.id === s.id))
                    .filter(s =>
                      !studentSearchQuery ||
                      s.name?.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                      s.email?.toLowerCase().includes(studentSearchQuery.toLowerCase())
                    )
                    .map(s => (
                      <div key={s.id} className="flex justify-between items-center p-3 bg-black/20 border border-white/5 rounded-xl group hover:border-[var(--color-primary)]/40 transition-all">
                        <div className="flex flex-col truncate pr-4 text-left">
                          <span className="font-bold text-gray-200 text-sm truncate">{s.name || "Unknown User"}</span>
                          <span className="text-xs text-gray-500 font-mono truncate">{s.email}</span>
                          <span className="text-[9px] text-gray-500 uppercase font-black tracking-tighter mt-1">Current: {s.cohort || 'DEFAULT'}</span>
                        </div>
                        <button
                          onClick={() => handleAddStudentToCohort(s.id)}
                          disabled={processingUsers.has(s.id)}
                          className="px-3 py-1.5 rounded-lg bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)] text-[var(--color-primary)] hover:text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 flex-shrink-0"
                        >
                          {processingUsers.has(s.id) ? '...' : 'Add'}
                        </button>
                      </div>
                    ))}
                  {students.filter(s => !cohortMembers.some(m => m.id === s.id)).length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 p-8 text-center opacity-50">
                      <span className="text-3xl mb-2">🎉</span>
                      <p className="text-sm">All students are already enrolled.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--color-card-border)] bg-black/40 flex justify-end">
              <button
                onClick={() => setShowStudentModal(false)}
                className="px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-emerald-400 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
