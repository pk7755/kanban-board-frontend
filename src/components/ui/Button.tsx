/**
 * Button.tsx
 * Single button component used throughout the app.
 * Variants: primary | secondary | ghost | danger
 */

import '@/styles/components/Button.css'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  iconOnly?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  iconOnly = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size !== 'md' ? `btn--${size}` : '',
    iconOnly ? 'btn--icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  )
}
