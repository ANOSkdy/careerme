import 'react';

declare module 'react' {
  interface ButtonHTMLAttributes<T> extends React.HTMLAttributes<T> {
    variant?: string;
  }
}
