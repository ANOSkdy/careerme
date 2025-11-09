'use client';

import {
  Children,
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  ReactElement,
  ReactNode,
} from 'react';

type TabsContextValue = {
  activeValue: string;
  setActiveValue: (value: string) => void;
  registerTab: (value: string, ref: HTMLButtonElement | null) => void;
  getTabRef: (value: string) => HTMLButtonElement | null;
  getPanelId: (value: string) => string;
  getTabId: (value: string) => string;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error(`${component} must be used within <Tabs>`);
  }
  return ctx;
}

type TabsProps = {
  value?: string;
  defaultValue: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
};

type TabListProps = HTMLAttributes<HTMLDivElement>;
type TabProps = {
  value: string;
  children: ReactNode;
  disabled?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

type TabPanelProps = {
  value: string;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export function Tabs({ value, defaultValue, onValueChange, children, className }: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const activeValue = value ?? uncontrolledValue;
  const registryRef = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const idPrefix = useId();

  const registerTab = useCallback((tabValue: string, ref: HTMLButtonElement | null) => {
    registryRef.current.set(tabValue, ref);
  }, []);

  const setActiveValue = useCallback(
    (next: string) => {
      if (next === activeValue) return;
      onValueChange?.(next);
      if (value === undefined) {
        setUncontrolledValue(next);
      }
    },
    [activeValue, onValueChange, value]
  );

  const contextValue = useMemo<TabsContextValue>(
    () => ({
      activeValue,
      setActiveValue,
      registerTab,
      getTabRef: (tabValue: string) => registryRef.current.get(tabValue) ?? null,
      getPanelId: (tabValue: string) => `${idPrefix}-panel-${tabValue}`,
      getTabId: (tabValue: string) => `${idPrefix}-tab-${tabValue}`,
    }),
    [activeValue, idPrefix, registerTab, setActiveValue]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, ...rest }: TabListProps) {
  const { activeValue, setActiveValue, getTabRef } = useTabsContext('TabsList');
  const childArray = useMemo(() => Children.toArray(children) as ReactElement<TabProps>[], [children]);
  const tabValues = useMemo(() => childArray.map((child) => child.props.value), [childArray]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const values = tabValues;
      if (!values.length) return;
      const currentIndex = Math.max(values.findIndex((item) => item === activeValue), 0);

      const focusByOffset = (offset: number) => {
        for (let i = 1; i <= values.length; i += 1) {
          const nextIndex = (currentIndex + offset * i + values.length) % values.length;
          const targetValue = values[nextIndex];
          const ref = getTabRef(targetValue);
          if (ref && !ref.disabled) {
            event.preventDefault();
            ref.focus();
            setActiveValue(targetValue);
            break;
          }
        }
      };

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown': {
          focusByOffset(1);
          break;
        }
        case 'ArrowLeft':
        case 'ArrowUp': {
          focusByOffset(-1);
          break;
        }
        case 'Home': {
          event.preventDefault();
          for (const value of values) {
            const ref = getTabRef(value);
            if (ref && !ref.disabled) {
              ref.focus();
              setActiveValue(value);
              break;
            }
          }
          break;
        }
        case 'End': {
          event.preventDefault();
          for (let i = values.length - 1; i >= 0; i -= 1) {
            const value = values[i];
            const ref = getTabRef(value);
            if (ref && !ref.disabled) {
              ref.focus();
              setActiveValue(value);
              break;
            }
          }
          break;
        }
        default:
          break;
      }
    },
    [activeValue, getTabRef, setActiveValue, tabValues]
  );

  return (
    <div role="tablist" onKeyDown={handleKeyDown} {...rest}>
      {childArray}
    </div>
  );
}

export function Tab({ value, disabled = false, children, onClick, ...rest }: TabProps) {
  const { activeValue, setActiveValue, registerTab, getTabId, getPanelId } = useTabsContext('Tab');
  const isSelected = value === activeValue;

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (!event.defaultPrevented && !disabled) {
        setActiveValue(value);
      }
    },
    [disabled, onClick, setActiveValue, value]
  );

  const handleRef = useCallback(
    (node: HTMLButtonElement | null) => {
      registerTab(value, node);
    },
    [registerTab, value]
  );

  return (
    <button
      ref={handleRef}
      role="tab"
      id={getTabId(value)}
      type="button"
      tabIndex={isSelected ? 0 : -1}
      aria-selected={isSelected}
      aria-controls={getPanelId(value)}
      disabled={disabled}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </button>
  );
}

export function TabPanel({ value, children, ...rest }: TabPanelProps) {
  const { activeValue, getPanelId, getTabId } = useTabsContext('TabPanel');
  const isSelected = value === activeValue;

  return (
    <div
      role="tabpanel"
      id={getPanelId(value)}
      aria-labelledby={getTabId(value)}
      hidden={!isSelected}
      tabIndex={0}
      {...rest}
    >
      {isSelected ? children : null}
    </div>
  );
}
