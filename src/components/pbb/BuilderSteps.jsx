import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const BuilderSteps = ({ steps, currentStep, completedSteps = new Set(), setCurrentStep = () => {}, disabled = false, nextStepId: nextStepIdProp, isEditMode = false }) => {
    const computedNextStepId = (() => {
        for (const step of steps) {
            if (!completedSteps.has(step.id)) {
                return step.id;
            }
        }
        return steps[steps.length - 1]?.id;
    })();
    const nextStepId = nextStepIdProp ?? computedNextStepId;

    const handleStepClick = (stepId) => {
        if (disabled || !setCurrentStep) return;
        if (isEditMode) {
            setCurrentStep(stepId);
            return;
        }
        // Only allow navigation to completed steps, current step, or the next available step
        const isCompleted = completedSteps.has(stepId);
        const isCurrent = stepId === currentStep;
        const isNext = stepId === nextStepId;
        if (isCompleted || isCurrent || isNext) {
            setCurrentStep(stepId);
        }
    };

    return (
        <div className="flex items-start mb-4 w-full">
            {steps.map((step, index) => {
                const isCompleted = completedSteps.has(step.id);
                const isActive = currentStep === step.id;
                const isNext = step.id === nextStepId && !isActive;
                const isNavigable = isEditMode || isCompleted || isActive || isNext;
                return (
                    <React.Fragment key={step.id}>
                        <div
                            className={cn(
                                "flex flex-col items-center text-center flex-1",
                                disabled ? "cursor-default opacity-80" :
                                isNavigable ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                            )}
                            onClick={() => handleStepClick(step.id)}
                        >
                            <div className={cn(
                                'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                                isActive
                                    ? 'bg-primary border-primary text-primary-foreground scale-110 shadow-lg ring-4 ring-primary/30'
                                    : 'bg-secondary border-border text-muted-foreground',
                                isCompleted && !isActive && 'bg-green-600 border-green-600 text-white',
                                isNext && 'highlight-next-step'
                            )}>
                                {isCompleted ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : <step.icon className="h-3 w-3 sm:h-4 sm:w-4" />}
                            </div>
                            <p className={cn(
                                'mt-1 sm:mt-2 text-[10px] sm:text-xs leading-tight hidden sm:block',
                                isActive ? 'text-primary font-bold' : 'text-muted-foreground font-medium',
                                isCompleted && !isActive && 'text-green-600 font-medium'
                            )}>
                                {step.name}
                            </p>
                            {/* Mobile: only show label for active step */}
                            <p className={cn(
                                'mt-1 text-[9px] font-medium leading-tight sm:hidden max-w-[60px] truncate',
                                isActive ? 'text-foreground' : 'text-muted-foreground',
                                isCompleted && !isActive && 'text-green-600'
                            )}>
                                {isActive ? step.name : ''}
                            </p>
                        </div>
                        {index < steps.length - 1 && (<div className={`w-full h-0.5 mt-4 sm:mt-5 rounded-full transition-colors duration-300 ${completedSteps.has(step.id) && completedSteps.has(steps[index + 1]?.id) ? 'bg-green-600' : (currentStep > steps[index + 1]?.id ? 'bg-primary' : 'bg-border')}`} />)}
                    </React.Fragment>
                )
            })}
        </div>
    );
};