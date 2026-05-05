-- Create a sample project for Western Riding AQHA from John Doe
INSERT INTO public.projects (
  user_id, 
  project_name, 
  project_type, 
  status,
  project_data
) VALUES (
  '09f47f1a-5ecd-4d99-8994-a9499990ee8b',
  'Western Riding AQHA Pattern Book',
  'pattern_book',
  'active',
  '{
    "showName": "Western Riding AQHA Championship",
    "associations": ["AQHA"],
    "disciplines": [{"id": "western-riding", "name": "Western Riding", "association_id": "AQHA"}],
    "venueName": "Oklahoma City Fairgrounds",
    "venueAddress": "3001 General Pershing Blvd, Oklahoma City, OK",
    "startDate": "2025-01-15",
    "endDate": "2025-01-18",
    "patternDisciplines": [
      {
        "disciplineName": "Western Riding",
        "association_ids": ["AQHA"],
        "patternGroups": [
          {"id": "group-1", "name": "Group 1", "divisions": [{"name": "Open", "level": "All Levels"}]},
          {"id": "group-2", "name": "Group 2", "divisions": [{"name": "Amateur Level 1", "level": "Level 1"}]}
        ]
      }
    ]
  }'::jsonb
);