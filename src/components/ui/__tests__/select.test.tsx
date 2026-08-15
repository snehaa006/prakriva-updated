import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../select";

/**
 * `SelectContent` renders nothing while the dropdown is closed, so its
 * `SelectItem` children never mount and never register their labels. That left
 * `SelectValue` blank on first paint for every select in the app — a settings
 * page of empty boxes until you opened each dropdown once. The root now seeds
 * the label map by walking its children, and these tests pin that down.
 */

const Fixture = ({ value }: { value?: string }) => (
  <Select value={value} onValueChange={() => {}}>
    <SelectTrigger aria-label="Sort">
      <SelectValue placeholder="Pick one" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="relevance">Most relevant</SelectItem>
      <SelectItem value="price-asc">Price: low to high</SelectItem>
    </SelectContent>
  </Select>
);

describe("SelectValue on first render", () => {
  it("shows the selected item's label without the dropdown ever being opened", () => {
    render(<Fixture value="price-asc" />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Price: low to high");
  });

  it("falls back to the placeholder when nothing is selected", () => {
    render(<Fixture />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Pick one");
  });

  it("shows a label for a value that does not exist rather than crashing", () => {
    render(<Fixture value="nope" />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Pick one");
  });

  it("finds items nested inside a group", () => {
    render(
      <Select value="b">
        <SelectTrigger aria-label="Grouped">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Group</SelectLabel>
            <SelectItem value="b">Nested label</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("Nested label");
  });

  it("updates when the selected value changes", () => {
    const { rerender } = render(<Fixture value="relevance" />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Most relevant");
    rerender(<Fixture value="price-asc" />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Price: low to high");
  });
});

describe("choosing a value", () => {
  it("reports the chosen value and shows its label", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <Select defaultValue="relevance" onValueChange={onValueChange}>
        <SelectTrigger aria-label="Sort">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="relevance">Most relevant</SelectItem>
          <SelectItem value="price-asc">Price: low to high</SelectItem>
        </SelectContent>
      </Select>,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Price: low to high" }));

    expect(onValueChange).toHaveBeenCalledWith("price-asc");
    expect(screen.getByRole("combobox")).toHaveTextContent("Price: low to high");
  });
});
