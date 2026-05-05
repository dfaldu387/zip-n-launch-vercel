import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const ShowBuilderSteps = ({ steps, currentStep, completedSteps = new Set(), setCurrentStep = () => {}, isEditMode = false }) => {
    const nextStepId = (() => {
        for (const step of steps) {
            if (!completedSteps.has(step.id)) return step.id;
        }
        return steps[steps.length - 1]?.id;
    })();

    return (
        <div className="flex items-start mb-8 w-full">
            {steps.map((step, index) => {
                const isCompleted = completedSteps.has(step.id);
                const isActive = currentStep === step.id;
                const isNavigable = isEditMode || isCompleted || isActive || step.id === nextStepId;
                const Icon = step.icon;

                return (
                    <React.Fragment key={step.id}>
                        <div
                            className={cn(
                                'flex flex-col items-center text-center flex-1',
                                isNavigable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                            )}
                            onClick={() => isNavigable && setCurrentStep(step.id)}
                        >
                            <div className={cn(
                                'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                                isActive ? 'bg-primary border-primary text-primary-foreground' : 'bg-secondary border-border text-muted-foreground',
                                isCompleted && !isActive && 'bg-green-600 border-green-600 text-white'
                            )}>
                                {isCompleted ? <Check className="h-4 w-4" /> : Icon ? <Icon className="h-4 w-4" /> : step.id}
                            </div>
                            <p className={cn(
                                'mt-2 text-xs font-medium leading-tight',
                                isActive ? 'text-foreground' : 'text-muted-foreground',
                                isCompleted && !isActive && 'text-green-600'
                            )}>
                                {step.name}
                            </p>
                        </div>
                        {index < steps.length - 1 && (
                            <div className={cn(
                                'w-full h-0.5 mt-5 rounded-full transition-colors duration-300',
                                completedSteps.has(step.id) && completedSteps.has(steps[index + 1]?.id)
                                    ? 'bg-green-600'
                                    : currentStep > steps[index + 1]?.id
                                        ? 'bg-primary'
                                        : 'bg-border'
                            )} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default ShowBuilderSteps;
