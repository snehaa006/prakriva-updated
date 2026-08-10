import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Plus, Pill, Utensils, Calendar, Trash2, Bell, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Reminder {
  id: string;
  title: string;
  type: "medicine" | "meal" | "appointment" | "exercise";
  time: string;
  days: string[];
  isActive: boolean;
  description?: string;
}

export default function Reminders() {
  const { toast } = useToast();
  const [reminders, setReminders] = useState<Reminder[]>([
    {
      id: "1",
      title: "Ashwagandha Tablets",
      type: "medicine",
      time: "08:00",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      isActive: true,
      description: "Take 2 tablets with warm water"
    },
    {
      id: "2",
      title: "Morning Breakfast",
      type: "meal",
      time: "09:00",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      isActive: true,
      description: "Poha with vegetables and green tea"
    },
    {
      id: "3",
      title: "Yoga Session",
      type: "exercise",
      time: "06:30",
      days: ["Mon", "Wed", "Fri"],
      isActive: true,
      description: "30 minutes of pranayama and asanas"
    },
    {
      id: "4",
      title: "Dr. Rajesh Consultation",
      type: "appointment",
      time: "15:00",
      days: ["Fri"],
      isActive: true,
      description: "Weekly checkup and progress review"
    },
    {
      id: "5",
      title: "Triphala Churna",
      type: "medicine",
      time: "22:00",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      isActive: false,
      description: "1 teaspoon with warm water before bed"
    }
  ]);

  const [newReminder, setNewReminder] = useState({
    title: "",
    type: "medicine" as "medicine" | "meal" | "appointment" | "exercise",
    time: "",
    days: [] as string[],
    description: ""
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "medicine": return <Pill className="h-4 w-4" />;
      case "meal": return <Utensils className="h-4 w-4" />;
      case "appointment": return <Calendar className="h-4 w-4" />;
      case "exercise": return <Bell className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Type badges map onto the dosha palette so a reminder's kind reads at a
  // glance, and share the same soft-tint treatment as the rest of the app —
  // no hard-saturated fills.
  const getTypeStyle = (type: string) => {
    switch (type) {
      case "medicine": return "bg-vata/10 text-vata";
      case "meal": return "bg-kapha/10 text-kapha";
      case "appointment": return "bg-accent-soft text-accent-soft-foreground";
      case "exercise": return "bg-pitta/10 text-pitta";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const toggleReminder = (id: string) => {
    setReminders(prev => prev.map(reminder =>
      reminder.id === id ? { ...reminder, isActive: !reminder.isActive } : reminder
    ));
    toast({
      title: "Reminder updated",
      description: "Reminder status has been changed.",
    });
  };

  const deleteReminder = (id: string) => {
    setReminders(prev => prev.filter(reminder => reminder.id !== id));
    toast({
      title: "Reminder deleted",
      description: "It won't remind you anymore.",
    });
  };

  const addReminder = () => {
    if (!newReminder.title || !newReminder.time) {
      toast({
        title: "Missing details",
        description: "Please fill in a title and a time.",
        variant: "destructive",
      });
      return;
    }

    const reminder: Reminder = {
      id: Date.now().toString(),
      ...newReminder,
      isActive: true,
    };

    setReminders(prev => [...prev, reminder]);
    setNewReminder({
      title: "",
      type: "medicine",
      time: "",
      days: [],
      description: ""
    });
    setIsDialogOpen(false);

    toast({
      title: "Reminder added",
      description: "We'll nudge you right on schedule.",
    });
  };

  const allDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const toggleDay = (day: string) => {
    setNewReminder(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  };

  const activeReminders = reminders.filter(r => r.isActive);
  const inactiveReminders = reminders.filter(r => !r.isActive);

  const stats = [
    {
      label: "Active reminders",
      value: activeReminders.length,
      icon: Bell,
    },
    {
      label: "Medicine",
      value: reminders.filter(r => r.type === "medicine" && r.isActive).length,
      icon: Pill,
    },
    {
      label: "Meals",
      value: reminders.filter(r => r.type === "meal" && r.isActive).length,
      icon: Utensils,
    },
  ];

  const ReminderRow = ({ reminder }: { reminder: Reminder }) => (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 transition-opacity sm:flex-row sm:items-center sm:justify-between",
        !reminder.isActive && "opacity-60"
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", getTypeStyle(reminder.type))}>
          {getTypeIcon(reminder.type)}
        </div>
        <div className="min-w-0">
          <h4 className="text-subhead font-semibold text-foreground">{reminder.title}</h4>
          <p className="mt-0.5 text-footnote text-foreground-secondary">
            {reminder.time} &middot; {reminder.days.length === 7 ? "Every day" : reminder.days.join(", ")}
          </p>
          {reminder.description && (
            <p className="mt-1 text-caption1 text-foreground-tertiary">{reminder.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Switch
          checked={reminder.isActive}
          onCheckedChange={() => toggleReminder(reminder.id)}
          aria-label={reminder.isActive ? "Turn off reminder" : "Turn on reminder"}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => deleteReminder(reminder.id)}
          aria-label="Delete reminder"
        >
          <Trash2 className="h-4 w-4 text-foreground-tertiary" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-title1 text-foreground">Reminders</h1>
          <p className="mt-1 text-body text-foreground-secondary">
            Gentle nudges for medicine, meals, movement and appointments.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gap-1.5 sm:w-auto">
              <Plus className="h-4 w-4" />
              Add reminder
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Create a reminder</DialogTitle>
              <DialogDescription>
                Set up a nudge for your health routine.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Take Chyawanprash"
                  value={newReminder.title}
                  onChange={(e) => setNewReminder(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={newReminder.type}
                  onValueChange={(value: "medicine" | "meal" | "appointment" | "exercise") =>
                    setNewReminder(prev => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medicine">Medicine</SelectItem>
                    <SelectItem value="meal">Meal</SelectItem>
                    <SelectItem value="appointment">Appointment</SelectItem>
                    <SelectItem value="exercise">Exercise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={newReminder.time}
                  onChange={(e) => setNewReminder(prev => ({ ...prev, time: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Repeat on</Label>
                <div className="flex flex-wrap gap-2">
                  {allDays.map(day => (
                    <Badge
                      key={day}
                      variant={newReminder.days.includes(day) ? "default" : "outline"}
                      className="cursor-pointer select-none px-3 py-1"
                      onClick={() => toggleDay(day)}
                    >
                      {day}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Notes (optional)</Label>
                <Input
                  id="description"
                  placeholder="Additional details…"
                  value={newReminder.description}
                  onChange={(e) => setNewReminder(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <Button onClick={addReminder} className="w-full">
                Create reminder
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats — quiet summary strip, not competing tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-2xl border border-border bg-accent-soft/40 px-4 py-3.5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-primary">
              <stat.icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-title3 leading-none text-foreground">{stat.value}</p>
              <p className="mt-1 text-caption1 text-foreground-secondary">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Active Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline">Active reminders</CardTitle>
          <CardDescription>What's currently scheduled</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activeReminders.map((reminder) => (
              <ReminderRow key={reminder.id} reminder={reminder} />
            ))}

            {activeReminders.length === 0 && (
              <div className="flex flex-col items-center py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-primary">
                  <BellOff className="h-5 w-5" />
                </span>
                <p className="mt-3 text-subhead text-foreground">No active reminders</p>
                <p className="mt-1 text-footnote text-foreground-secondary">
                  Add your first one and we'll take it from there.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Inactive Reminders */}
      {inactiveReminders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-headline">Paused</CardTitle>
            <CardDescription>Turned off, but ready whenever you are</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inactiveReminders.map((reminder) => (
                <ReminderRow key={reminder.id} reminder={reminder} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
