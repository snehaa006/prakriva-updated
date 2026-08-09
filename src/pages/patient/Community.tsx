import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  Clock,
  Loader2,
  LogOut,
  MessageCircle,
  Send,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { useCachedPageData } from "@/hooks/useCachedPageData";
import {
  cleanMessageBody,
  defaultDisplayName,
  isRecommendedFor,
  membershipFor,
  sortGroupsForPatient,
} from "@/lib/community";
import {
  decideRequest,
  fetchMessages,
  leaveGroup,
  loadCommunityOverview,
  requestToJoin,
  sendMessage,
  subscribeToMessages,
} from "@/services/communityService";
import type {
  CommunityGroup,
  CommunityMembership,
  CommunityMessage,
} from "@/types/community";

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/**
 * The patient's community.
 *
 * Circles are condition-shaped — pregnancy, PCOS, thyroid, anaemia, new
 * mothers — because that is what women actually want to compare notes about,
 * and the ones matching her own profile and screening are surfaced first.
 * Every circle is request-to-join and the chat inside is readable only by
 * approved members (enforced by RLS, see supabase/community.sql): these are
 * conversations about miscarriage and mental health, not a public feed.
 *
 * Requests are approved by the members themselves, so a circle does not need a
 * moderator the app does not have.
 */
const Community = () => {
  const { toast } = useToast();
  const patientId = useAuthUserId();

  // One cached snapshot for the whole page: leaving and coming back re-renders
  // from it instead of putting a spinner over circles she was just reading.
  // Writes below re-read it rather than patching a second copy of the state.
  const { data, isFirstLoad, error, refresh } = useCachedPageData(
    ["community", patientId],
    () => loadCommunityOverview(patientId as string),
    { enabled: !!patientId }
  );

  const groups = useMemo(() => data?.groups ?? [], [data]);
  const memberships = useMemo(() => data?.memberships ?? [], [data]);
  const requests = useMemo(() => data?.pendingRequests ?? [], [data]);
  const matchKeys = useMemo(() => data?.matchKeys ?? ["general"], [data]);
  const accountName = data?.accountName ?? "";

  // Controlled so "Open chat" on a circle in Discover can move to the chat.
  const [tab, setTab] = useState("discover");
  const hasChosenTab = useRef(false);

  // Join dialog
  const [joining, setJoining] = useState<CommunityGroup | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [intro, setIntro] = useState("");
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);

  // Chat
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEnd = useRef<HTMLDivElement | null>(null);

  const groupsById = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups]
  );

  const myCircles = useMemo(
    () =>
      memberships
        .filter((m) => m.status === "approved")
        .map((m) => groupsById.get(m.groupId))
        .filter((g): g is CommunityGroup => g !== undefined),
    [memberships, groupsById]
  );

  const orderedGroups = useMemo(
    () => sortGroupsForPatient(groups, matchKeys),
    [groups, matchKeys]
  );

  /** Requests waiting on *other* people — never her own. */
  const incomingRequests = useMemo(
    () => requests.filter((request) => request.patientId !== patientId),
    [requests, patientId]
  );

  useEffect(() => {
    if (error) {
      console.error("Error loading community circles:", error);
      toast({
        title: "Could not load the circles",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Open on the first circle she is in. Runs off the loaded data rather than
  // the fetch, so a cached page lands on the same circle it did last time.
  useEffect(() => {
    if (myCircles.length === 0) return;
    setActiveGroupId((current) =>
      current && myCircles.some((g) => g.id === current) ? current : myCircles[0].id
    );

    // Someone already in a circle came here for the conversation; someone who
    // isn't came to find one. Once only — a background refresh must not yank
    // her out of a tab she chose herself.
    if (!hasChosenTab.current) {
      hasChosenTab.current = true;
      setTab("circles");
    }
  }, [myCircles]);

  // ── Chat ──
  useEffect(() => {
    if (!activeGroupId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setIsLoadingMessages(true);

    void fetchMessages(activeGroupId)
      .then((loaded) => {
        if (!cancelled) setMessages(loaded);
      })
      .catch((error) => {
        console.error("Error loading messages:", error);
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMessages(false);
      });

    // Live updates where realtime is enabled; the chat still works without it.
    const unsubscribe = subscribeToMessages(activeGroupId, (message) => {
      setMessages((current) =>
        current.some((m) => m.id === message.id) ? current : [...current, message]
      );
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeGroupId]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  const openJoinDialog = (group: CommunityGroup) => {
    setJoining(group);
    setDisplayName(defaultDisplayName(accountName));
    setIntro("");
  };

  const submitJoin = async () => {
    if (!joining || !patientId) return;
    const name = displayName.trim() || defaultDisplayName(accountName);

    setIsSubmittingJoin(true);
    try {
      const membership = await requestToJoin({
        groupId: joining.id,
        patientId,
        displayName: name,
        intro,
      });

      setJoining(null);
      await refresh();

      if (membership.status === "approved") {
        setActiveGroupId(membership.groupId);
        setTab("circles");
        toast({
          title: `Welcome to ${joining.name}`,
          description: "You're in — say hello whenever you're ready.",
        });
      } else {
        toast({
          title: "Request sent",
          description: `A member of ${joining.name} will let you in shortly.`,
        });
      }
    } catch (error) {
      console.error("Could not send the join request:", error);
      toast({
        title: "Could not send your request",
        description:
          error instanceof Error ? error.message : "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  const decide = async (
    membership: CommunityMembership,
    status: "approved" | "declined"
  ) => {
    try {
      await decideRequest(membership.id, status);
      await refresh();
      toast({
        title: status === "approved" ? "Request approved" : "Request declined",
        description:
          status === "approved"
            ? `${membership.displayName} can now see and join the conversation.`
            : `${membership.displayName} has not been added.`,
      });
    } catch (error) {
      console.error("Could not decide on the request:", error);
      toast({
        title: "Could not update the request",
        description:
          error instanceof Error ? error.message : "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const leave = async (group: CommunityGroup) => {
    const membership = membershipFor(memberships, group.id);
    if (!membership) return;

    try {
      await leaveGroup(membership.id);
      setActiveGroupId((current) => (current === group.id ? null : current));
      await refresh();
      toast({
        title: `You have left ${group.name}`,
        description: "You can ask to rejoin any time.",
      });
    } catch (error) {
      console.error("Could not leave the circle:", error);
      toast({
        title: "Could not leave the circle",
        description:
          error instanceof Error ? error.message : "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const post = async () => {
    const body = cleanMessageBody(draft);
    if (!body || !activeGroupId || !patientId) return;

    const membership = membershipFor(memberships, activeGroupId);
    setIsSending(true);
    try {
      const message = await sendMessage({
        groupId: activeGroupId,
        authorId: patientId,
        authorName: membership?.displayName ?? defaultDisplayName(accountName),
        body,
      });
      // Realtime echoes this back; de-duplicate on id so it appears once.
      setMessages((current) =>
        current.some((m) => m.id === message.id) ? current : [...current, message]
      );
      setDraft("");
    } catch (error) {
      console.error("Could not send the message:", error);
      toast({
        title: "Message not sent",
        description:
          error instanceof Error ? error.message : "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Only ever on the very first visit — coming back renders from the cached
  // snapshot while it refreshes underneath.
  if (isFirstLoad) {
    return (
      <div className="flex-1 p-6">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading your circles...</p>
          </div>
        </div>
      </div>
    );
  }

  const activeGroup = activeGroupId ? groupsById.get(activeGroupId) : undefined;

  return (
    <div className="flex-1 space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
          <Users className="h-7 w-7" />
          Community
        </h1>
        <p className="text-muted-foreground">
          Circles of women going through the same thing — pregnancy, PCOS, thyroid,
          anaemia and more. Ask to join, and the conversation opens up.
        </p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="mx-auto mb-4 h-16 w-16 text-muted-foreground opacity-50" />
            <h3 className="mb-2 text-xl font-semibold">No circles yet</h3>
            <p className="text-muted-foreground">
              The community circles have not been set up for this project yet. Once
              they are, they will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="circles" className="gap-1">
              <MessageCircle className="h-4 w-4" />
              My circles
              {myCircles.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {myCircles.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="discover" className="gap-1">
              <Sparkles className="h-4 w-4" />
              Discover
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-1">
              <UserPlus className="h-4 w-4" />
              Requests
              {incomingRequests.length > 0 && (
                <Badge className="ml-1">{incomingRequests.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── My circles: the chat ── */}
          <TabsContent value="circles">
            {myCircles.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <MessageCircle className="mx-auto mb-4 h-16 w-16 text-muted-foreground opacity-50" />
                  <h3 className="mb-2 text-xl font-semibold">
                    You haven't joined a circle yet
                  </h3>
                  <p className="text-muted-foreground">
                    Open <strong>Discover</strong> to find the circles that match what
                    you are going through.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-base">Your circles</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {myCircles.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setActiveGroupId(group.id)}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${
                          group.id === activeGroupId
                            ? "border-primary/40 bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="font-medium">{group.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">
                          {activeGroup?.name ?? "Pick a circle"}
                        </CardTitle>
                        <CardDescription>{activeGroup?.description}</CardDescription>
                      </div>
                      {activeGroup && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => leave(activeGroup)}
                        >
                          <LogOut className="h-4 w-4" />
                          Leave
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="h-96 space-y-3 overflow-y-auto rounded-lg bg-muted/30 p-3">
                      {isLoadingMessages ? (
                        <div className="flex h-full items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : messages.length === 0 ? (
                        <p className="py-12 text-center text-sm text-muted-foreground">
                          No messages yet. Be the first to say hello.
                        </p>
                      ) : (
                        messages.map((message) => {
                          const mine = message.authorId === patientId;
                          return (
                            <div
                              key={message.id}
                              className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}
                            >
                              {!mine && (
                                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                                  {initials(message.authorName)}
                                </div>
                              )}
                              <div
                                className={`max-w-[80%] rounded-lg p-3 ${
                                  mine
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-background"
                                }`}
                              >
                                {!mine && (
                                  <p className="text-xs font-semibold">
                                    {message.authorName}
                                  </p>
                                )}
                                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                  {message.body}
                                </p>
                                <p
                                  className={`mt-1 text-xs ${
                                    mine
                                      ? "text-primary-foreground/70"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {timeLabel(message.createdAt)}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEnd} />
                    </div>

                    <div className="flex gap-2">
                      <Input
                        placeholder="Share how you're doing..."
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void post();
                          }
                        }}
                        disabled={!activeGroupId}
                      />
                      <Button
                        onClick={post}
                        disabled={!cleanMessageBody(draft) || isSending}
                        aria-label="Send message"
                      >
                        {isSending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Members support each other here — it is not medical advice. Talk
                      to your doctor before acting on anything you read.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ── Discover: browse and ask to join ── */}
          <TabsContent value="discover" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {orderedGroups.map((group) => {
                const membership = membershipFor(memberships, group.id);
                const recommended = isRecommendedFor(group, matchKeys);

                return (
                  <Card key={group.id} className={recommended ? "border-primary/30" : ""}>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <CardTitle className="text-base">{group.name}</CardTitle>
                        {recommended && (
                          <Badge className="gap-1">
                            <Sparkles className="h-3 w-3" />
                            Suits your profile
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{group.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">{group.whoItsFor}</p>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                        </span>

                        {membership?.status === "approved" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setActiveGroupId(group.id);
                              setTab("circles");
                            }}
                          >
                            <MessageCircle className="h-4 w-4" />
                            Open chat
                          </Button>
                        ) : membership?.status === "pending" ? (
                          <Badge variant="outline" className="gap-1">
                            <Clock className="h-3 w-3" />
                            Request pending
                          </Badge>
                        ) : membership?.status === "declined" ? (
                          <Badge variant="outline" className="gap-1">
                            <X className="h-3 w-3" />
                            Not accepted
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="gap-1"
                            onClick={() => openJoinDialog(group)}
                          >
                            <UserPlus className="h-4 w-4" />
                            Ask to join
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ── Requests: peers waiting to be let in ── */}
          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Requests to join your circles</CardTitle>
                <CardDescription>
                  Circles are kept by their members. Anyone you approve can read and
                  post in that circle.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {incomingRequests.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nobody is waiting right now.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {incomingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{request.displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {groupsById.get(request.groupId)?.name ?? "A circle"} ·
                            asked {timeLabel(request.requestedAt)}
                          </p>
                          {request.intro && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              “{request.intro}”
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="gap-1"
                            onClick={() => decide(request, "approved")}
                          >
                            <Check className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => decide(request, "declined")}
                          >
                            <X className="h-4 w-4" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* ── Join dialog ── */}
      <Dialog open={joining !== null} onOpenChange={(open) => !open && setJoining(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join {joining?.name}</DialogTitle>
            <DialogDescription>
              {joining?.whoItsFor} A member of the circle sees your request and lets
              you in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="community-display-name">Name shown in the circle</Label>
              <Input
                id="community-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground">
                Use whatever you're comfortable with — it doesn't have to be your real
                name.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="community-intro">Say a little about yourself</Label>
              <Textarea
                id="community-intro"
                placeholder="e.g. 28 weeks with my first, looking for people at the same stage"
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">Optional.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setJoining(null)}>
              Cancel
            </Button>
            <Button onClick={submitJoin} disabled={isSubmittingJoin} className="gap-1">
              {isSubmittingJoin ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Send request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Community;
