// The profile picture, and the controls to change it.
//
// Lives on the Profile page and is read everywhere else (sidebar, header) off
// `user.avatar` in AppContext, so a new photo appears across the app the
// moment it is chosen rather than after a reload.
//
// The camera badge opens the file picker **directly**. It used to open a menu
// whose items called the picker, which never worked: this project's
// `DropdownMenuItem` is a plain div that only handles `onClick`, so the
// `onSelect` handler was silently dropped and the button did nothing. Even
// with that fixed, opening a file dialog from inside a menu that is closing
// and restoring focus in the same tick is fragile in several browsers — so
// there is no menu here at all. One button, one picker.

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import { ACCEPTED_TYPES, initialsOf, removeAvatar, saveAvatar } from "@/services/avatarService";
import { cn } from "@/lib/utils";

interface ProfilePhotoProps {
  /** Falls back to the signed-in user's name for the initials. */
  name?: string;
  className?: string;
  size?: "md" | "lg";
  /** Also show labelled Upload / Remove buttons beside the avatar. */
  showControls?: boolean;
}

export function ProfilePhoto({
  name,
  className,
  size = "lg",
  showControls = false,
}: ProfilePhotoProps) {
  const { user, setUser } = useApp();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"saving" | "removing" | null>(null);

  const displayName = name ?? user?.name;
  const dimension = size === "lg" ? "h-20 w-20 sm:h-24 sm:w-24" : "h-16 w-16";

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!user) {
      toast({
        title: "Sign in first",
        description: "We couldn't tell which account to save this photo to.",
        variant: "destructive",
      });
      return;
    }

    setBusy("saving");
    try {
      const { url, synced } = await saveAvatar(user.id, file);
      setUser({ ...user, avatar: url });
      toast({
        title: "Profile photo updated",
        description: synced
          ? "Your new photo is saved to your account."
          : "Saved on this device — photo storage isn't set up yet, so it won't follow you to another device.",
      });
    } catch (error) {
      toast({
        title: "Could not update your photo",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
      // Let the same file be picked again — after a failure, and after a
      // remove, since the input keeps its value otherwise and picking the
      // identical file fires no change event.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!user) return;

    setBusy("removing");
    try {
      await removeAvatar(user.id);
      setUser({ ...user, avatar: undefined });
      if (inputRef.current) inputRef.current.value = "";
      toast({ title: "Profile photo removed" });
    } finally {
      setBusy(null);
    }
  };

  const pick = () => inputRef.current?.click();

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative shrink-0">
        {/* The circle itself is what people reach for, so it opens the picker
            too — the badge is the discoverable version of the same action. */}
        <button
          type="button"
          onClick={pick}
          disabled={busy !== null}
          title={user?.avatar ? "Change profile photo" : "Add a profile photo"}
          aria-label={user?.avatar ? "Change profile photo" : "Add a profile photo"}
          className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className={cn(dimension, "shadow-sm ring-2 ring-border")}>
            {user?.avatar && <AvatarImage src={user.avatar} alt={displayName ?? "Profile photo"} />}
            <AvatarFallback className="bg-accent-soft text-title3 font-semibold text-primary">
              {initialsOf(displayName) || <Camera className="h-6 w-6" />}
            </AvatarFallback>
          </Avatar>
        </button>

        {/* Both badges sit at z-20: AvatarImage is z-10, so without it the
            photo covers them and swallows the clicks meant for them. */}
        <button
          type="button"
          onClick={pick}
          disabled={busy !== null}
          aria-hidden="true"
          tabIndex={-1}
          className="absolute -bottom-1 -right-1 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform duration-150 ease-ios hover:scale-105 active:scale-95"
        >
          {busy === "saving" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </button>

        {user?.avatar && !showControls && (
          <button
            type="button"
            onClick={() => void handleRemove()}
            disabled={busy !== null}
            title="Remove profile photo"
            aria-label="Remove profile photo"
            className="absolute -bottom-1 -left-1 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-destructive shadow-sm transition-transform duration-150 ease-ios hover:scale-105 active:scale-95"
          >
            {busy === "removing" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {showControls && (
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={pick} disabled={busy !== null}>
              <Upload className="mr-2 h-4 w-4" />
              {user?.avatar ? "Change photo" : "Add photo"}
            </Button>

            {user?.avatar && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void handleRemove()}
                disabled={busy !== null}
                className="text-destructive hover:text-destructive"
              >
                {busy === "removing" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, WebP or GIF, up to 8 MB. Cropped to a square and resized for you.
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
    </div>
  );
}

export default ProfilePhoto;
