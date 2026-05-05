import React, { useState, useMemo } from 'react';
import { X, Plus, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const PREDEFINED_TAGS = {
  Level: ['Walk-Trot', 'Green', 'Intermediate', 'Advanced', 'Championship', 'Open'],
  Discipline: ['Reining', 'Trail', 'Horsemanship', 'Western Riding', 'Ranch Riding', 'Hunter Under Saddle', 'Western Pleasure', 'Showmanship', 'Halter', 'Barrel Racing'],
  Special: ['Futurity', 'Derby', 'Non-Pro', 'Youth', 'Amateur', 'Select Amateur', 'Novice'],
};

const TAG_COLORS = {
  Level: 'bg-blue-100 text-blue-800 border-blue-200',
  Discipline: 'bg-green-100 text-green-800 border-green-200',
  Special: 'bg-purple-100 text-purple-800 border-purple-200',
  Custom: 'bg-gray-100 text-gray-800 border-gray-200',
};

function getTagCategory(tag) {
  for (const [category, tags] of Object.entries(PREDEFINED_TAGS)) {
    if (tags.includes(tag)) return category;
  }
  return 'Custom';
}

export default function PatternTagEditor({ tags = [], onChange, compact = false }) {
  const [customTag, setCustomTag] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const tagSet = useMemo(() => new Set(tags), [tags]);

  const toggleTag = (tag) => {
    const newTags = tagSet.has(tag)
      ? tags.filter(t => t !== tag)
      : [...tags, tag];
    onChange(newTags);
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim();
    if (trimmed && !tagSet.has(trimmed)) {
      onChange([...tags, trimmed]);
      setCustomTag('');
    }
  };

  const filteredPredefined = useMemo(() => {
    if (!searchFilter.trim()) return PREDEFINED_TAGS;
    const lower = searchFilter.toLowerCase();
    const result = {};
    for (const [category, categoryTags] of Object.entries(PREDEFINED_TAGS)) {
      const filtered = categoryTags.filter(t => t.toLowerCase().includes(lower));
      if (filtered.length > 0) result[category] = filtered;
    }
    return result;
  }, [searchFilter]);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {tags.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
        {tags.map(tag => (
          <Badge
            key={tag}
            variant="outline"
            className={`text-xs ${TAG_COLORS[getTagCategory(tag)]}`}
          >
            {tag}
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Current tags */}
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {tags.map(tag => {
          const category = getTagCategory(tag);
          return (
            <Badge
              key={tag}
              variant="outline"
              className={`text-xs cursor-pointer hover:opacity-70 ${TAG_COLORS[category]}`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          );
        })}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
              <Plus className="h-3 w-3 mr-1" /> Add Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            {/* Search */}
            <Input
              placeholder="Search or type custom tag..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-8 text-xs mb-3"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (searchFilter.trim()) {
                    toggleTag(searchFilter.trim());
                    setSearchFilter('');
                  }
                }
              }}
            />

            {/* Predefined tags by category */}
            <div className="max-h-48 overflow-y-auto space-y-3">
              {Object.entries(filteredPredefined).map(([category, categoryTags]) => (
                <div key={category}>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">{category}</p>
                  <div className="flex flex-wrap gap-1">
                    {categoryTags.map(tag => (
                      <Badge
                        key={tag}
                        variant={tagSet.has(tag) ? 'default' : 'outline'}
                        className={`text-xs cursor-pointer ${tagSet.has(tag) ? '' : TAG_COLORS[category]} hover:opacity-80`}
                        onClick={() => toggleTag(tag)}
                      >
                        {tagSet.has(tag) ? '✓ ' : ''}{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Custom tag input */}
            <div className="mt-3 pt-3 border-t flex gap-1">
              <Input
                placeholder="Custom tag..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomTag();
                  }
                }}
              />
              <Button size="sm" className="h-7 px-2 text-xs" onClick={addCustomTag} disabled={!customTag.trim()}>
                Add
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export { PREDEFINED_TAGS, TAG_COLORS, getTagCategory };
