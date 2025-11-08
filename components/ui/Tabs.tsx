'use client';

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type PropsWithChildren,
} from 'react';

function classNames(...values: Array<string | undefined | null | false>): string {
  return values.filter(Boolean).join(' ');
}

type TabsContextValue = {
  value: string | null;
  setValue: (value: string) => void;
  baseId: string;
  orientation: 'horizontal' | 'vertical';
};

const TabsContext = createContext<TabsContextValue | null>(null);

type TabsProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
} & PropsWithChildren;

export function Tabs({
  children,
  value,
  defaultValue,
  onValueChange,
  orientation = 'horizontal',
  className,
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? null);
  const isControlled = typeof value !== 'undefined';
  const currentValue = isControlled ? value ?? null : internalValue;

  const setValue = useCallback(
    (next: string) => {
      if (!isControlled) {
        setInternalValue(next);
      }
      onValueChange?.(next);
    },
    [isControlled, onValueChange]
  );

  const baseId = useId();

  const contextValue = useMemo(
    () => ({
      value: currentValue,
      setValue,
      baseId,
      orientation,
    }),
    [currentValue, setValue, baseId, orientation]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={classNames('ui-tabs', className)}>{children}</div>
      <style jsx>{`
        .ui-tabs {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
      `}</style>
    </TabsContext.Provider>
  );
}

function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(`${component} must be used within <Tabs>`);
  }
  return context;
}

type TabsListProps = {
  className?: string;
} & PropsWithChildren;

export function TabsList({ children, className }: TabsListProps) {
  const { orientation } = useTabsContext('TabsList');
  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      className={classNames('ui-tabs__list', className)}
    >
      {children}
      <style jsx>{`
        .ui-tabs__list {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background-color: var(--color-bg);
          padding: 0.25rem;
          border-radius: 999px;
          border: 1px solid rgba(58, 117, 196, 0.15);
        }
      `}</style>
    </div>
  );
}

type TabsTriggerProps = {
  value: string;
  className?: string;
} & PropsWithChildren;

export function TabsTrigger({ value, className, children }: TabsTriggerProps) {
  const { value: currentValue, setValue, baseId } = useTabsContext('TabsTrigger');
  const isActive = currentValue === value;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const keysHorizontal = ['ArrowRight', 'ArrowLeft'];
    const keysVertical = ['ArrowUp', 'ArrowDown'];
    const keysAll = ['Home', 'End'];

    if (![...keysHorizontal, ...keysVertical, ...keysAll].includes(event.key)) {
      return;
    }

    const list = event.currentTarget.parentElement;
    if (!list) return;
    const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const currentIndex = tabs.indexOf(event.currentTarget);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;

    if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    }

    const target = tabs[nextIndex];
    if (target && target !== event.currentTarget) {
      event.preventDefault();
      const nextValue = target.getAttribute('data-tab-value');
      if (nextValue) {
        setValue(nextValue);
      }
      target.focus();
    }
  };

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      aria-controls={`${baseId}-panel-${value}`}
      id={`${baseId}-tab-${value}`}
      data-tab-value={value}
      className={classNames('ui-tabs__trigger', isActive && 'is-active', className)}
      tabIndex={isActive ? 0 : -1}
      onClick={() => setValue(value)}
      onKeyDown={handleKeyDown}
    >
      <span>{children}</span>
      <style jsx>{`
        .ui-tabs__trigger {
          border: none;
          background: none;
          padding: 0.5rem 1.25rem;
          border-radius: 999px;
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--color-muted);
          transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
        }

        .ui-tabs__trigger.is-active {
          background-image: var(--gradient-ai);
          color: #ffffff;
          box-shadow: var(--shadow-soft);
        }
      `}</style>
    </button>
  );
}

type TabsContentProps = {
  value: string;
  className?: string;
} & PropsWithChildren;

export function TabsContent({ value, className, children }: TabsContentProps) {
  const { value: currentValue, baseId } = useTabsContext('TabsContent');
  const isActive = currentValue === value;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      hidden={!isActive}
      className={classNames('ui-tabs__panel', className)}
    >
      {children}
      <style jsx>{`
        .ui-tabs__panel[hidden] {
          display: none;
        }

        .ui-tabs__panel {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
      `}</style>
    </div>
  );
}
