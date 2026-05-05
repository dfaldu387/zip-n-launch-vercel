import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DayTabs = ({ days, activeDayId, onChangeDay }) => {
  if (!days || days.length <= 1) return null;

  return (
    <div className="mb-4">
      <Tabs value={activeDayId} onValueChange={onChangeDay}>
        <TabsList>
          {days.map(day => (
            <TabsTrigger key={day.id} value={day.id}>
              {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
};

export default DayTabs;
