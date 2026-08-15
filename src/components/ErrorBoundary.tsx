"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: undefined,
    errorInfo: undefined
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("CRITICAL JOURNEY ERROR:", error);
    console.error("Journey Render Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-mono">
          <p className="font-bold text-sm mb-1">Journey Render Error Details:</p>
          <p className="mb-2 font-semibold">{this.state.error?.toString()}</p>
          <pre className="whitespace-pre-wrap overflow-x-auto text-[10px] text-red-600 bg-red-100 p-2 rounded">
            {this.state.errorInfo?.componentStack || this.state.error?.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
