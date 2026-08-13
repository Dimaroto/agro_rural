"use client";

import { useRef } from "react";
import { useUnsavedChangesOptional } from "@/components/admin/UnsavedChangesContext";

export function AdminSignOutButton({
  signOutAction,
}: {
  signOutAction: () => Promise<void>;
}) {
  const unsaved = useUnsavedChangesOptional();
  const bypassRef = useRef(false);

  return (
    <form
      action={signOutAction}
      onSubmit={(event) => {
        if (bypassRef.current) {
          bypassRef.current = false;
          return;
        }
        if (!unsaved?.isDirty) return;
        event.preventDefault();
        const form = event.currentTarget;
        unsaved.requestNavigation({
          type: "callback",
          run: () => {
            bypassRef.current = true;
            form.requestSubmit();
          },
        });
      }}
    >
      <button type="submit" className="admin-btn-ghost max-md:px-2 max-md:text-xs">
        Sair
      </button>
    </form>
  );
}
