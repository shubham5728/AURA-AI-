/**
 * Catches render errors so one broken component does not blank the whole app.
 *
 * React unmounts the entire tree when a render throws. Without a boundary the
 * user gets a white page with nothing to act on -- and during a demo, no way
 * back short of a reload.
 *
 * Deliberately reassuring about data: people whose health records are in an app
 * assume a crash lost something. Nothing here writes, so nothing is lost, and
 * saying so is worth the two lines.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept in the console rather than sent anywhere: a stack trace from a health
    // app can carry a user's data in its variables, and there is no reporting
    // endpoint that has been reviewed for that.
    console.error('Render error caught by boundary:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="center" style={{ flexDirection: 'column', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
        <AlertTriangle size={40} />
        <h2>This screen ran into a problem</h2>
        <p style={{ maxWidth: 460, opacity: 0.8 }}>
          Your health data is safe — nothing was being saved when this happened.
          You can go back and continue.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn primary" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
          <button className="btn ghost" onClick={() => location.assign('/app')}>
            Back to dashboard
          </button>
        </div>
        <details style={{ marginTop: '1rem', opacity: 0.6, maxWidth: 560 }}>
          <summary style={{ cursor: 'pointer' }}>Technical details</summary>
          <pre style={{ textAlign: 'left', overflow: 'auto', fontSize: 12 }}>
            {this.state.error.message}
          </pre>
        </details>
      </div>
    );
  }
}
