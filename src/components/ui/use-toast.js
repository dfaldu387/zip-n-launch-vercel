import React from "react";

const TOAST_LIMIT = 5;

let count = 0;
function generateId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

const toastStore = {
  state: {
    toasts: [],
  },
  listeners: [],
  
  getState: () => toastStore.state,
  
  setState: (nextState) => {
    if (typeof nextState === 'function') {
      toastStore.state = nextState(toastStore.state);
    } else {
      toastStore.state = { ...toastStore.state, ...nextState };
    }
    
    toastStore.listeners.forEach(listener => listener(toastStore.state));
  },
  
  subscribe: (listener) => {
    toastStore.listeners.push(listener);
    return () => {
      toastStore.listeners = toastStore.listeners.filter(l => l !== listener);
    };
  }
};

export const toast = ({ ...props }) => {
  const id = generateId();

  const update = (props) =>
    toastStore.setState((state) => ({
      ...state,
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, ...props } : t
      ),
    }));

  const dismiss = () => toastStore.setState((state) => ({
    ...state,
    toasts: state.toasts.filter((t) => t.id !== id),
  }));

  toastStore.setState((state) => ({
    ...state,
    toasts: [
      { ...props, id, dismiss },
      ...state.toasts,
    ].slice(0, TOAST_LIMIT),
  }));

  return {
    id,
    dismiss,
    update,
  };
};

export function useToast() {
  const [state, setState] = React.useState(toastStore.getState());
  
  React.useEffect(() => {
    const unsubscribe = toastStore.subscribe((state) => {
      setState(state);
    });
    
    return unsubscribe;
  }, []);
  
  React.useEffect(() => {
    const timeouts = [];

    state.toasts.forEach((toastItem) => {
      const { duration, variant, dismiss } = toastItem;

      if (duration === Infinity || (variant === 'destructive' && duration === undefined)) {
        return;
      }

      const timeout = setTimeout(() => {
        dismiss();
      }, duration || 5000);

      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [state.toasts]);

  return {
    toast,
    toasts: state.toasts,
  };
}