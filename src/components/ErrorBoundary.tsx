"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: undefined
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("CRITICAL JOURNEY ERROR:", error);
    console.error("Journey Render Error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 border-2 border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 font-mono text-sm">
          Something went wrong loading this content.
          {process.env.NODE_ENV !== 'production' && <pre className="mt-2 text-xs text-red-500 whitespace-pre-wrap">{this.state.error?.message}</pre>}
        </div>
      );
    }

    return this.props.children;
  }
}
