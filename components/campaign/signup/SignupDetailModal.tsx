"use client";

import { useCallback, useEffect, useState } from "react";
import { X, User, Mail, FileHeart, FolderOpen, ListTodo, StickyNote, History } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { First20Signup, First20Email, First20SignupNote, Document, TaskItem } from "@/lib/supabase/types";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import SignupOverviewTab from "./SignupOverviewTab";
import SignupEmailsTab from "./SignupEmailsTab";
import SignupFeedbackOrderTab from "./SignupFeedbackOrderTab";
import SignupDocumentsTab from "./SignupDocumentsTab";
import SignupTasksTab from "./SignupTasksTab";
import SignupNotesTab from "./SignupNotesTab";
import SignupTimelineTab from "./SignupTimelineTab";

type Tab = "overview" | "emails" | "feedback" | "documents" | "tasks" | "notes" | "log";

const TABS: { key: Tab; label: string; icon: typeof User }[] = [
  { key: "overview", label: "Áttekintés", icon: User },
  { key: "emails", label: "E-mailek", icon: Mail },
  { key: "feedback", label: "Visszajelzés és rendelés", icon: FileHeart },
  { key: "documents", label: "Dokumentumok", icon: FolderOpen },
  { key: "tasks", label: "Feladatok", icon: ListTodo },
  { key: "notes", label: "Jegyzetek", icon: StickyNote },
  { key: "log", label: "Napló", icon: History },
];

/**
 * Jelentkező részletnézet — egy helyen az adatok, e-mail-előzmények,
 * visszajelzés/rendelés, dokumentumok, feladatok, jegyzetek és egy
 * egységes időrendi napló. Felváltja a korábbi "csak Feladat gomb"
 * mintát: a lista bármelyik sorára kattintva ez nyílik meg.
 */
export default function SignupDetailModal({
  signupId,
  campaignId,
  onClose,
  onChanged,
}: {
  signupId: string;
  campaignId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [signup, setSignup] = useState<First20Signup | null>(null);
  const [emails, setEmails] = useState<First20Email[]>([]);
  const [notes, setNotes] = useState<First20SignupNote[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [signupRes, emailsRes, notesRes, documentsRes, tasksRes] = await Promise.all([
      supabase.from("first20_signups").select("*").eq("id", signupId).maybeSingle(),
      supabase.from("first20_emails").select("*").eq("signup_id", signupId).order("created_at", { ascending: false }),
      supabase.from("first20_signup_notes").select("*").eq("signup_id", signupId).order("created_at", { ascending: false }),
      supabase.from("documents").select("*").eq("signup_id", signupId).order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").eq("signup_id", signupId).order("created_at", { ascending: false }),
    ]);
    if (signupRes.error) setError(signupRes.error.message);
    else if (!signupRes.data) setError("A jelentkező nem található — lehet, hogy törölve lett.");
    else setSignup(signupRes.data);
    if (!emailsRes.error) setEmails(emailsRes.data ?? []);
    if (!notesRes.error) setNotes(notesRes.data ?? []);
    if (!documentsRes.error) setDocuments(documentsRes.data ?? []);
    if (!tasksRes.error) setTasks(tasksRes.data ?? []);
    setLoading(false);
  }, [supabase, signupId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void load();
  }, [supabase, load]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function refreshAfterChange() {
    void load();
    onChanged();
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-forest/40 px-2 py-4 backdrop-blur-[2px] sm:px-4 sm:py-8"
      onClick={onClose}
    >
      <div
        className="animate-fade-in card mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden sm:max-h-[calc(100vh-4rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="truncate font-serif text-lg text-forest">
              {signup ? `${signup.first_name}${signup.partner_first_name ? ` & ${signup.partner_first_name}` : ""}` : "Jelentkező"}
            </h2>
            {signup && <p className="truncate text-xs text-muted">{signup.email}</p>}
          </div>
          <button onClick={onClose} className="shrink-0 rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest" aria-label="Bezárás">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-border bg-ivory-dim/40 p-3 sm:px-5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`btn !py-1.5 text-xs ${tab === key ? "btn-bronze" : "btn-ghost"}`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-4 sm:p-5">
          {error && <ErrorBanner message={error} />}
          {loading || !signup ? (
            <Spinner />
          ) : (
            <>
              {tab === "overview" && <SignupOverviewTab signup={signup} onUpdated={refreshAfterChange} />}
              {tab === "emails" && <SignupEmailsTab signup={signup} emails={emails} onSent={refreshAfterChange} />}
              {tab === "feedback" && <SignupFeedbackOrderTab signup={signup} onUpdated={refreshAfterChange} />}
              {tab === "documents" && <SignupDocumentsTab signup={signup} documents={documents} onChanged={refreshAfterChange} />}
              {tab === "tasks" && (
                <SignupTasksTab signup={signup} campaignId={campaignId} tasks={tasks} onChanged={refreshAfterChange} />
              )}
              {tab === "notes" && <SignupNotesTab signup={signup} notes={notes} onChanged={refreshAfterChange} />}
              {tab === "log" && (
                <SignupTimelineTab signup={signup} emails={emails} notes={notes} documents={documents} tasks={tasks} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
