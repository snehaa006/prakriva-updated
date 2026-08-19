import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * The photo control is tested against fakes for the two things it talks to:
 * the app's user (AppContext) and the avatar storage service.
 *
 * The regression worth pinning: the upload control used to be a
 * `DropdownMenuItem` with an `onSelect` handler, and this project's menu item
 * is a plain div that only wires `onClick` — so the handler never ran and
 * "upload a photo" did nothing at all. These tests fail if the picker stops
 * being reachable from a plain click.
 */
const state = vi.hoisted(() => ({
  user: {
    id: "patient-1",
    name: "Priya Sharma",
    email: "priya@example.com",
    role: "patient" as const,
    avatar: undefined as string | undefined,
  },
  setUser: vi.fn(),
  saveAvatar: vi.fn(),
  removeAvatar: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/context/AppContext", () => ({
  useApp: () => ({ user: state.user, setUser: state.setUser }),
}));

// Toasts render through a <Toaster> that lives in the app shell, not in this
// render, so assert on what the component asked to show.
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: state.toast }),
}));

vi.mock("@/services/avatarService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/avatarService")>();
  return {
    ...actual,
    saveAvatar: (...args: unknown[]) => state.saveAvatar(...args),
    removeAvatar: (...args: unknown[]) => state.removeAvatar(...args),
  };
});

const { ProfilePhoto } = await import("@/components/ProfilePhoto");

const file = () => new File(["binary"], "me.png", { type: "image/png" });

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(() => {
  state.user = {
    id: "patient-1",
    name: "Priya Sharma",
    email: "priya@example.com",
    role: "patient",
    avatar: undefined,
  };
  state.setUser.mockReset();
  state.toast.mockReset();
  state.saveAvatar.mockReset().mockResolvedValue({ url: "blob:new-photo", synced: true });
  state.removeAvatar.mockReset().mockResolvedValue(undefined);
});

describe("ProfilePhoto", () => {
  it("opens the file picker when the avatar is clicked", async () => {
    const user = userEvent.setup();
    const clicked = vi.spyOn(HTMLInputElement.prototype, "click");
    render(<ProfilePhoto />);

    await user.click(screen.getByRole("button", { name: /add a profile photo/i }));

    expect(clicked).toHaveBeenCalled();
    clicked.mockRestore();
  });

  it("saves the chosen file and shows it across the app", async () => {
    const user = userEvent.setup();
    render(<ProfilePhoto />);

    await user.upload(fileInput(), file());

    await waitFor(() => expect(state.saveAvatar).toHaveBeenCalledWith("patient-1", expect.any(File)));
    expect(state.setUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: "patient-1", avatar: "blob:new-photo" })
    );
  });

  it("says the photo is device-only when storage is not set up", async () => {
    state.saveAvatar.mockResolvedValue({ url: "data:image/jpeg;base64,x", synced: false });
    const user = userEvent.setup();
    render(<ProfilePhoto />);

    await user.upload(fileInput(), file());

    await waitFor(() =>
      expect(state.toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: expect.stringMatching(/saved on this device/i) })
      )
    );
  });

  it("reports a rejected file instead of failing silently", async () => {
    state.saveAvatar.mockRejectedValue(new Error("That image is larger than 8 MB."));
    const user = userEvent.setup();
    render(<ProfilePhoto />);

    await user.upload(fileInput(), file());

    await waitFor(() =>
      expect(state.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: expect.stringMatching(/larger than 8 MB/i),
        })
      )
    );
    expect(state.setUser).not.toHaveBeenCalled();
  });

  it("offers replacing and removing once a photo exists", async () => {
    state.user.avatar = "blob:existing";
    const user = userEvent.setup();
    render(<ProfilePhoto />);

    // The same control now reads as "change", and removal is available.
    expect(screen.getByRole("button", { name: /change profile photo/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove profile photo/i }));

    await waitFor(() => expect(state.removeAvatar).toHaveBeenCalledWith("patient-1"));
    expect(state.setUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: "patient-1", avatar: undefined })
    );
  });

  it("lets the same file be picked again after a failure", async () => {
    state.saveAvatar.mockRejectedValueOnce(new Error("nope"));
    const user = userEvent.setup();
    render(<ProfilePhoto />);

    await user.upload(fileInput(), file());
    await waitFor(() => expect(state.saveAvatar).toHaveBeenCalledTimes(1));
    // A file input keeps its value, and re-picking the identical file fires no
    // change event unless it was cleared.
    expect(fileInput().value).toBe("");

    await user.upload(fileInput(), file());
    await waitFor(() => expect(state.saveAvatar).toHaveBeenCalledTimes(2));
  });

  it("shows the labelled buttons when asked", async () => {
    render(<ProfilePhoto showControls />);
    expect(screen.getByRole("button", { name: /add photo/i })).toBeInTheDocument();
  });
});
