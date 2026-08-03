import React from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

// Catches any JavaScript error thrown while rendering a page and shows a
// friendly fallback instead of unmounting the whole app (blank white screen).
class ErrorBoundaryInner extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  // Once a page threw, the boundary stayed broken for the rest of the session —
  // navigating away (or using browser back) kept showing the error screen. Clearing
  // on a route change lets a healthy page render normally again.
  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.pathname !== this.props.pathname) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error, errorInfo) {
    // Log so it still shows in the browser console / error monitoring.
    console.error('App error caught by ErrorBoundary:', error, errorInfo);
  }

  handleGoHome = () => {
    // Full reload to a clean state.
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-md w-full text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">
              Sorry, this page ran into a problem. Please go back to the home page and try again.
            </p>
            <button
              onClick={this.handleGoHome}
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Error boundaries have to be class components, and classes cannot use hooks —
// so the current path is passed in from this thin wrapper.
const ErrorBoundary = ({ children }) => {
  const location = useLocation();
  return <ErrorBoundaryInner pathname={location.pathname}>{children}</ErrorBoundaryInner>;
};

export default ErrorBoundary;
