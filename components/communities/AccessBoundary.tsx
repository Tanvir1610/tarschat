"use client";

import { Component, type ReactNode } from "react";
import { ShieldOff } from "lucide-react";
import { EmptyState } from "../ui";

/**
 * If a live query starts failing (you were removed/banned, the community was deleted…)
 * show a calm message instead of crashing the app.
 */
export class AccessBoundary extends Component<{ children: ReactNode; onExit: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <EmptyState
        className="h-full"
        icon={<ShieldOff className="h-6 w-6" />}
        title="You no longer have access"
        description="This community may have been deleted, or your membership changed."
        action={<button onClick={this.props.onExit} className="btn-primary">Back to communities</button>}
      />
    );
  }
}
