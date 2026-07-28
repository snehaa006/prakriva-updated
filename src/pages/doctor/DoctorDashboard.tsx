import React, { useState, useEffect, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  onSnapshot,
  updateDoc,
  addDoc,
  deleteDoc,
  Timestamp,
  limit as fbLimit,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  Calendar,
  Activity,
  Bell,
  Plus,
  MessageCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Video,
  TrendingUp,
  ChevronRight,
  Eye,
  UserCheck,
  Utensils,
  Loader2,
  Check,
  X,
  Phone,
  MapPin,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface DoctorInfo {
  name: string;
  specialization: string;
  initials: string;
  loading: boolean;
}

interface AppointmentData {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  time: string;
  type: "consultation" | "follow-up" | "emergency";
  mode: "in-person" | "video-call" | "phone";
  duration: number;
  notes: string;
  status: "scheduled" | "completed" | "cancelled" | "no-show";
  createdAt?: any;
}

interface NotificationData {
  id: string;
  type: "consultation_request" | "meal_tracking" | "appointment" | "alert" | "info";
  message: string;
  read: boolean;
  createdAt: any;
  patientId?: string;
  patientName?: string;
  requestId?: string;
}

interface ConsultRequest {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail?: string;
  requestType: string;
  urgency: string;
  message?: string;
  status: string;
  requestedAt: any;
  preferredConsultationMode?: string;
}

interface PatientProgress {
  patientId: string;
  patientName: string;
  eatenCount: number;
  totalMeals: number;
  completionPct: number;
  lastTracked: string;
}

type ScheduleTab = "today" | "week" | "month";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function getInitials(name: string): string {
  if (!name || name === "Loading...") return "DR";
  return name.split(" ").map(p => p.charAt(0)).join("").toUpperCase().slice(0, 2);
}

function formatDate(d: any): string {
  if (!d) return "";
  const date = d?.toDate ? d.toDate() : new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split("T")[0];
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
}

function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const { consultationRequests: appRequests } = useApp();

  const [doctorData, setDoctorData] = useState<DoctorInfo>({ name: "Loading...", specialization: "Loading...", initials: "DR", loading: true });
  const [doctorId, setDoctorId] = useState<string>("");
  const [scheduleTab, setScheduleTab] = useState<ScheduleTab>("today");

  // Firebase data
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [requests, setRequests] = useState<ConsultRequest[]>([]);
  const [patientProgress, setPatientProgress] = useState<PatientProgress[]>([]);
  const [patientCount, setPatientCount] = useState(0);

  // Loading
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [loadingNotifs, setLoadingNotifs] = useState(true);

  // ── Load doctor data ──
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setDoctorId(user.uid);
        try {
          const snap = await getDoc(doc(db, "doctors", user.uid));
          if (snap.exists()) {
            const d = snap.data();
            setDoctorData({
              name: d.name || "Dr. Unknown",
              specialization: d.ayurvedicSpecialization?.join(", ") || d.specialization || "Practitioner",
              initials: getInitials(d.name || "Dr Unknown"),
              loading: false,
            });
          } else {
            setDoctorData({ name: "Doctor", specialization: "Practitioner", initials: "DR", loading: false });
          }
        } catch {
          setDoctorData({ name: "Doctor", specialization: "Practitioner", initials: "DR", loading: false });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // ── Load appointments from Firebase ──
  useEffect(() => {
    if (!doctorId) return;
    setLoadingAppts(true);

    const loadAppointments = async () => {
      try {
        const q = query(
          collection(db, "doctors", doctorId, "appointments"),
          orderBy("date", "asc")
        );
        const snap = await getDocs(q);
        const appts: AppointmentData[] = [];
        snap.forEach(d => {
          appts.push({ id: d.id, ...d.data() } as AppointmentData);
        });
        setAppointments(appts);
      } catch {
        // Collection may not exist yet
        setAppointments([]);
      } finally {
        setLoadingAppts(false);
      }
    };
    loadAppointments();
  }, [doctorId]);

  // ── Real-time notifications from Firebase ──
  useEffect(() => {
    if (!doctorId) return;
    setLoadingNotifs(true);

    // Listen to doctor's notifications subcollection
    const q = query(
      collection(db, "doctors", doctorId, "notifications"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const notifs: NotificationData[] = [];
      snap.forEach(d => {
        notifs.push({ id: d.id, ...d.data() } as NotificationData);
      });
      setNotifications(notifs);
      setLoadingNotifs(false);
    }, () => {
      // Collection may not exist yet
      setNotifications([]);
      setLoadingNotifs(false);
    });

    return () => unsubscribe();
  }, [doctorId]);

  // ── Load consultation requests ──
  useEffect(() => {
    if (!doctorId) return;
    const loadRequests = async () => {
      try {
        const q = query(
          collection(db, "consultationRequests"),
          where("doctorId", "==", doctorId),
          orderBy("requestedAt", "desc")
        );
        const snap = await getDocs(q);
        const reqs: ConsultRequest[] = [];
        snap.forEach(d => {
          reqs.push({ id: d.id, ...d.data() } as ConsultRequest);
        });
        setRequests(reqs);
      } catch {
        // Use app context requests as fallback
        setRequests(appRequests.map(r => ({
          id: r.id,
          patientId: r.patientId,
          patientName: r.patientName,
          requestType: r.requestType,
          urgency: r.urgency,
          message: r.message,
          status: r.status,
          requestedAt: r.date,
          preferredConsultationMode: r.mode,
        })));
      }
    };
    loadRequests();
  }, [doctorId, appRequests]);

  // ── Load patient progress data ──
  useEffect(() => {
    if (!doctorId) return;
    const loadProgress = async () => {
      try {
        // Get all patients assigned to this doctor via consultation requests
        const reqSnap = await getDocs(
          query(collection(db, "consultationRequests"), where("doctorId", "==", doctorId))
        );
        const patientIds = new Set<string>();
        const patientNames: Record<string, string> = {};
        reqSnap.forEach(d => {
          const data = d.data();
          if (data.patientId) {
            patientIds.add(data.patientId);
            patientNames[data.patientId] = data.patientName || "Unknown";
          }
        });

        setPatientCount(patientIds.size);

        // Get today's tracking for each patient
        const today = new Date().toISOString().split("T")[0];
        const progressData: PatientProgress[] = [];

        for (const pid of Array.from(patientIds).slice(0, 20)) {
          try {
            const trackSnap = await getDoc(doc(db, "patients", pid, "mealTracking", today));
            if (trackSnap.exists()) {
              const t = trackSnap.data();
              progressData.push({
                patientId: pid,
                patientName: patientNames[pid] || "Unknown",
                eatenCount: t.eatenCount || 0,
                totalMeals: t.totalMeals || 0,
                completionPct: t.totalMeals > 0 ? Math.round((t.eatenCount / t.totalMeals) * 100) : 0,
                lastTracked: today,
              });
            } else {
              progressData.push({
                patientId: pid,
                patientName: patientNames[pid] || "Unknown",
                eatenCount: 0,
                totalMeals: 0,
                completionPct: 0,
                lastTracked: "No data",
              });
            }
          } catch {
            // Skip this patient
          }
        }

        setPatientProgress(progressData);
      } catch (e) {
        console.error("Error loading patient progress:", e);
      }
    };
    loadProgress();
  }, [doctorId]);

  // ── Mark notification as read ──
  const markNotifRead = useCallback(async (notifId: string) => {
    if (!doctorId) return;
    try {
      await updateDoc(doc(db, "doctors", doctorId, "notifications", notifId), { read: true, readAt: Timestamp.now() });
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    } catch {
      // Just update locally
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    }
  }, [doctorId]);

  // ── Clear all notifications ──
  const clearAllNotifs = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    // Batch update in Firebase
    if (doctorId) {
      notifications.filter(n => !n.read).forEach(n => {
        updateDoc(doc(db, "doctors", doctorId, "notifications", n.id), { read: true }).catch(() => {});
      });
    }
  }, [doctorId, notifications]);

  // ── Update request status ──
  const updateRequestStatus = useCallback(async (reqId: string, status: "accepted" | "rejected") => {
    try {
      await updateDoc(doc(db, "consultationRequests", reqId), {
        status,
        statusUpdatedAt: Timestamp.now(),
      });
      setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status } : r));

      // Create notification for doctor
      if (doctorId) {
        const req = requests.find(r => r.id === reqId);
        await addDoc(collection(db, "doctors", doctorId, "notifications"), {
          type: "consultation_request",
          message: `You ${status} ${req?.patientName || "a patient"}'s consultation request.`,
          read: false,
          createdAt: Timestamp.now(),
          patientId: req?.patientId,
          patientName: req?.patientName,
          requestId: reqId,
        }).catch(() => {});
      }

      toast.success(`Request ${status}`);
    } catch {
      toast.error("Failed to update request");
    }
  }, [doctorId, requests]);

  // ── Filtered appointments ──
  const filteredAppointments = appointments.filter(a => {
    if (scheduleTab === "today") return isToday(a.date);
    if (scheduleTab === "week") return isThisWeek(a.date);
    if (scheduleTab === "month") return isThisMonth(a.date);
    return true;
  });

  // ── Computed stats ──
  const unreadCount = notifications.filter(n => !n.read).length;
  const pendingRequests = requests.filter(r => r.status === "pending");
  const todayAppts = appointments.filter(a => isToday(a.date));
  const completedAppts = appointments.filter(a => a.status === "completed").length;
  const avgPatientCompletion = patientProgress.length > 0
    ? Math.round(patientProgress.reduce((s, p) => s + p.completionPct, 0) / patientProgress.length)
    : 0;

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-lg">{doctorData.initials}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome back, {doctorData.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              {doctorData.specialization} · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="gap-2" onClick={() => navigate("/doctor/add-patient")}>
            <Plus className="w-4 h-4" /> Add Patient
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate("/doctor/patients")}>
            <Users className="w-4 h-4" /> Patients
          </Button>
          <Button variant="outline" className="gap-2 relative" onClick={() => navigate("/doctor/appointments")}>
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-2 -right-2 bg-destructive text-white text-xs h-5 w-5 rounded-full p-0 flex items-center justify-center">
                {unreadCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50"><Users className="w-5 h-5 text-indigo-600" /></div>
              <div>
                <p className="text-2xl font-bold">{patientCount}</p>
                <p className="text-xs text-muted-foreground">Total Patients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50"><Calendar className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <p className="text-2xl font-bold">{todayAppts.length}</p>
                <p className="text-xs text-muted-foreground">Today's Appointments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50"><AlertCircle className="w-5 h-5 text-amber-600" /></div>
              <div>
                <p className="text-2xl font-bold">{pendingRequests.length}</p>
                <p className="text-xs text-muted-foreground">Pending Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50"><TrendingUp className="w-5 h-5 text-purple-600" /></div>
              <div>
                <p className="text-2xl font-bold">{avgPatientCompletion}%</p>
                <p className="text-xs text-muted-foreground">Avg Patient Adherence</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Schedule + Patient Progress */}
        <div className="lg:col-span-2 space-y-6">

          {/* Schedule Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" /> Schedule Overview
                </CardTitle>
                <div className="flex bg-muted p-1 rounded-lg">
                  {(["today", "week", "month"] as ScheduleTab[]).map(tab => (
                    <Button
                      key={tab}
                      variant={scheduleTab === tab ? "default" : "ghost"}
                      size="sm"
                      className="px-3 py-1 text-xs"
                      onClick={() => setScheduleTab(tab)}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAppts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">
                    No appointments for {scheduleTab === "today" ? "today" : scheduleTab === "week" ? "this week" : "this month"}.
                  </p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("/doctor/appointments")}>
                    <Plus className="w-3 h-3 mr-1" /> Schedule Appointment
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAppointments.map(appt => (
                    <div key={appt.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                      appt.status === "completed" ? "bg-emerald-50/50 border-emerald-200" :
                      appt.status === "cancelled" ? "bg-red-50/50 border-red-200 opacity-60" :
                      "bg-muted/30"
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white border">
                          {appt.mode === "video-call" ? <Video className="w-4 h-4 text-blue-500" /> :
                           appt.mode === "phone" ? <Phone className="w-4 h-4 text-green-500" /> :
                           <MapPin className="w-4 h-4 text-orange-500" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{appt.patientName}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{appt.date} · {appt.time}</span>
                            <Badge variant="outline" className="text-[10px]">{appt.type}</Badge>
                          </div>
                        </div>
                      </div>
                      <Badge className={`text-xs ${
                        appt.status === "scheduled" ? "bg-blue-100 text-blue-700" :
                        appt.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                        appt.status === "cancelled" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {appt.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Patient Progress Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> Patient Progress
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => navigate("/doctor/patients")}>
                  View All <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
              <CardDescription>Today's meal tracking adherence</CardDescription>
            </CardHeader>
            <CardContent>
              {patientProgress.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Utensils className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No patient tracking data yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {patientProgress.slice(0, 8).map(p => (
                    <div key={p.patientId} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-xs font-medium text-indigo-700">
                        {p.patientName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">{p.patientName}</span>
                          <span className="text-xs font-medium shrink-0">
                            {p.completionPct > 0 ? `${p.completionPct}%` : "No data"}
                          </span>
                        </div>
                        <Progress value={p.completionPct} className="h-1.5 mt-1" />
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {p.eatenCount}/{p.totalMeals} meals · Last: {p.lastTracked}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Appointments Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" /> Appointments Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-xl font-bold text-blue-600">{appointments.filter(a => a.status === "scheduled").length}</div>
                  <p className="text-xs text-muted-foreground">Scheduled</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-lg">
                  <div className="text-xl font-bold text-emerald-600">{completedAppts}</div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-xl font-bold text-red-600">{appointments.filter(a => a.status === "cancelled").length}</div>
                  <p className="text-xs text-muted-foreground">Cancelled</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <div className="text-xl font-bold text-amber-600">{appointments.filter(a => a.status === "no-show").length}</div>
                  <p className="text-xs text-muted-foreground">No-show</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Requests + Notifications */}
        <div className="space-y-6">

          {/* Consultation Requests */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" /> Patient Requests
                </CardTitle>
                {pendingRequests.length > 0 && (
                  <Badge variant="destructive" className="text-xs">{pendingRequests.length}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No consultation requests.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {requests.slice(0, 10).map(req => (
                    <div key={req.id} className={`p-3 rounded-lg border text-sm ${
                      req.status === "pending" ? "bg-amber-50/50 border-amber-200" :
                      req.status === "accepted" ? "bg-emerald-50/50 border-emerald-200" :
                      "bg-muted/30 border-muted"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{req.patientName}</span>
                        <Badge variant="outline" className={`text-[10px] ${
                          req.urgency === "high" || req.urgency === "emergency" ? "border-red-300 text-red-600" :
                          req.urgency === "medium" ? "border-amber-300 text-amber-600" :
                          "border-gray-300"
                        }`}>
                          {req.urgency}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{req.requestType} · {req.preferredConsultationMode || "any"}</p>
                      {req.message && <p className="text-xs text-muted-foreground mt-1 truncate">{req.message}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{formatDate(req.requestedAt)}</p>

                      {req.status === "pending" && (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 flex-1" onClick={() => updateRequestStatus(req.id, "accepted")}>
                            <Check className="w-3 h-3 mr-1" /> Accept
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => updateRequestStatus(req.id, "rejected")}>
                            <X className="w-3 h-3 mr-1" /> Decline
                          </Button>
                        </div>
                      )}
                      {req.status !== "pending" && (
                        <Badge className={`mt-2 text-[10px] ${req.status === "accepted" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {req.status}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Real-time Notifications */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-500" />
                  <CardTitle>Notifications</CardTitle>
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
                  )}
                </div>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAllNotifs} className="text-xs">
                    Mark all read
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingNotifs ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No notifications yet.</p>
                  <p className="text-xs mt-1">Real-time alerts will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {notifications.slice(0, 15).map(notif => (
                    <div
                      key={notif.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all text-sm ${
                        notif.read ? "bg-muted/20 border-muted" :
                        notif.type === "consultation_request" ? "bg-blue-50 border-blue-200" :
                        notif.type === "meal_tracking" ? "bg-emerald-50 border-emerald-200" :
                        notif.type === "appointment" ? "bg-purple-50 border-purple-200" :
                        notif.type === "alert" ? "bg-red-50 border-red-200" :
                        "bg-amber-50 border-amber-200"
                      }`}
                      onClick={() => !notif.read && markNotifRead(notif.id)}
                    >
                      <div className="flex items-start gap-2">
                        {notif.type === "consultation_request" && <MessageCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />}
                        {notif.type === "meal_tracking" && <Utensils className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />}
                        {notif.type === "appointment" && <Calendar className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />}
                        {notif.type === "alert" && <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />}
                        {notif.type === "info" && <Bell className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs ${notif.read ? "text-muted-foreground" : "font-medium"}`}>
                            {notif.message}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(notif.createdAt)}</p>
                        </div>
                        {!notif.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 shrink-0" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2 text-sm" onClick={() => navigate("/doctor/personalized-diet")}>
                <Utensils className="w-4 h-4" /> Create Diet Chart
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 text-sm" onClick={() => navigate("/doctor/recipes")}>
                <Activity className="w-4 h-4" /> Recipe Builder
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 text-sm" onClick={() => navigate("/doctor/food-explorer")}>
                <Eye className="w-4 h-4" /> Food Explorer
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 text-sm" onClick={() => navigate("/doctor/appointments")}>
                <Calendar className="w-4 h-4" /> Schedule Appointment
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
