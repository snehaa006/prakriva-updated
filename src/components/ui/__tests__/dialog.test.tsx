import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

/**
 * These four primitives are all built on the native `<dialog>` element and
 * share one lifecycle: the element is only rendered once the overlay has been
 * asked to open. The regression they guard against is the overlay staying
 * mounted-but-never-shown, which made every "View profile"-style button on a
 * card look dead.
 */
describe("native-dialog overlays", () => {
  it("shows content when Dialog is mounted already open", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Patient Profile</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByText("Patient Profile")).toBeInTheDocument();
  });

  it("shows content when Dialog is opened by its trigger", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>View Full Profile</DialogTrigger>
        <DialogContent>
          <DialogTitle>Patient Profile</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.queryByText("Patient Profile")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View Full Profile" }));
    expect(screen.getByText("Patient Profile")).toBeInTheDocument();
  });

  it("shows content for Sheet, Drawer and AlertDialog", () => {
    render(
      <>
        <Sheet open>
          <SheetContent>
            <SheetTitle>Sheet body</SheetTitle>
          </SheetContent>
        </Sheet>
        <Drawer open>
          <DrawerContent>
            <DrawerTitle>Drawer body</DrawerTitle>
          </DrawerContent>
        </Drawer>
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogTitle>Alert body</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      </>,
    );

    expect(screen.getByText("Sheet body")).toBeInTheDocument();
    expect(screen.getByText("Drawer body")).toBeInTheDocument();
    expect(screen.getByText("Alert body")).toBeInTheDocument();
  });

  it("removes Dialog content again once the exit transition is done", async () => {
    const { rerender } = render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Patient Profile</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByText("Patient Profile")).toBeInTheDocument();

    rerender(
      <Dialog open={false}>
        <DialogContent>
          <DialogTitle>Patient Profile</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    // The panel stays mounted for the fade-out, then goes away on its own.
    await waitFor(() =>
      expect(screen.queryByText("Patient Profile")).not.toBeInTheDocument(),
    );
  });
});
