import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, GripVertical, Save, RotateCcw } from 'lucide-react';

/**
 * ManeuverEditor — inline editable table for pattern maneuver steps.
 *
 * Props:
 *   steps: Array<{ stepNumber, instruction }>
 *   onChange: (steps) => void — called on every edit
 *   onSave: (steps) => Promise<void> — persist to DB
 *   readOnly: boolean
 */
const ManeuverEditor = ({ steps = [], onChange, onSave, readOnly = false }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [originalSteps] = useState(() => JSON.parse(JSON.stringify(steps)));

  const hasChanges = JSON.stringify(steps) !== JSON.stringify(originalSteps);

  const updateStep = (index, field, value) => {
    const updated = steps.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    );
    onChange?.(updated);
  };

  const addStep = () => {
    const nextNumber = steps.length > 0
      ? Math.max(...steps.map(s => s.stepNumber)) + 1
      : 1;
    const updated = [...steps, { stepNumber: nextNumber, instruction: '' }];
    onChange?.(updated);
  };

  const removeStep = (index) => {
    const updated = steps.filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, stepNumber: i + 1 }));
    onChange?.(updated);
  };

  const renumberSteps = () => {
    const updated = steps.map((s, i) => ({ ...s, stepNumber: i + 1 }));
    onChange?.(updated);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(steps);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    onChange?.(JSON.parse(JSON.stringify(originalSteps)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Maneuver Steps ({steps.length})
        </h3>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="mr-1 h-3 w-3" /> Reset
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={addStep}>
              <Plus className="mr-1 h-3 w-3" /> Add Step
            </Button>
            {onSave && hasChanges && (
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="mr-1 h-3 w-3" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        )}
      </div>

      {steps.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground text-sm">No maneuver steps extracted.</p>
          {!readOnly && (
            <Button variant="link" size="sm" onClick={addStep} className="mt-2">
              Add a step manually
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[20px]"></TableHead>
                <TableHead className="w-[60px]">Step</TableHead>
                <TableHead>Instruction</TableHead>
                {!readOnly && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((step, index) => (
                <TableRow key={index}>
                  <TableCell className="text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <span className="font-medium">{step.stepNumber}</span>
                    ) : (
                      <Input
                        type="number"
                        value={step.stepNumber}
                        onChange={(e) => updateStep(index, 'stepNumber', parseInt(e.target.value, 10) || 0)}
                        className="w-14 h-8 text-center"
                        min={1}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <span>{step.instruction}</span>
                    ) : (
                      <Input
                        value={step.instruction}
                        onChange={(e) => updateStep(index, 'instruction', e.target.value)}
                        placeholder="Enter maneuver instruction..."
                        className="h-8"
                      />
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeStep(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default ManeuverEditor;
