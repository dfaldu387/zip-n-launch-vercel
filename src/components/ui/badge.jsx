import React from 'react';
    import { cva } from 'class-variance-authority';
    
    import { cn } from '@/lib/utils';
    
    const badgeVariants = cva(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
      {
        variants: {
          variant: {
            default:
              'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
            secondary:
              'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
            destructive:
              'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
            outline: 'text-foreground',
            dualApproved: 'font-bold border-green-600 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400',
            standalone: 'font-bold border-indigo-600 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400',
            info: 'border-transparent bg-blue-500 text-white',
            discipline: 'border-transparent bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
          },
        },
        defaultVariants: {
          variant: 'default',
        },
      }
    );
    
    function Badge({
      className,
      variant,
      ...props
    }) {
      return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
    }
    
    export { Badge, badgeVariants };