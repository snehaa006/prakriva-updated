// The profile picture, and the controls to change it.
//
// Lives on the Profile page and is read everywhere else (sidebar, header) off
// `user.avatar` in AppContext, so a new photo appears across the app the
// moment it is chosen rather than after a reload.
//
// The camera badge is the whole control: it opens a menu with "Upload" and,
// once there is a photo, "Remove". `showControls` adds the same two actions as
// labelled buttons for places with room to explain them.

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    if (!file || !user) return;

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
      // Let the same file be picked again after a failure.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!user) return;

    setBusy("removing");
    try {
      await removeAvatar(user.id);
      setUser({ ...user, avatar: undefined });
      toast({ title: "Profile photo removed" });
    } finally {
      setBusy(null);
    }
  };

  const pick = () => inputRef.current?.click();

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative shrink-0">
        <Avatar className={cn(dimension, "shadow-sm ring-2 ring-border")}>
          {user?.avatar && <AvatarImage src={user.avatar} alt={displayName ?? "Profile photo"} />}
          <AvatarFallback className="bg-accent-soft text-title3 font-semibold text-primary">
            {initialsOf(displayName) || <Camera className="h-6 w-6" />}
          </AvatarFallback>
        </Avatar>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={busy !== null}
              aria-label={user?.avatar ? "Change profile photo" : "Add a profile photo"}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform duration-150 ease-ios hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={pick}>
              <Upload className="mr-2 h-4 w-4" />
              {user?.avatar ? "Upload a new photo" : "Upload a photo"}
            </DropdownMenuItem>
            {user?.avatar && (
              <DropdownMenuItem
                onSelect={() => void handleRemove()}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove photo
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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
