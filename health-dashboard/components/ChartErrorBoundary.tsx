"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  name: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ChartErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ChartErrorBoundary caught an error in "${this.props.name}":`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 flex flex-col justify-center items-center text-center min-h-[200px] w-full">
          <h3 className="text-sm font-semibold text-slate-200 mb-1">{this.props.name}</h3>
          <p className="text-xs text-slate-400">Failed to load — data may be unavailable.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChartErrorBoundary;
