-- Update the project with correctly formatted data for all steps
UPDATE public.projects 
SET project_data = '{
  "showName": "Western Riding AQHA Championship",
  "showType": "multi-day",
  "associations": {"AQHA": true},
  "customAssociations": [],
  "primaryAffiliates": [],
  "subAssociationSelections": {},
  "disciplines": [
    {
      "id": "western-riding-aqha",
      "name": "Western Riding",
      "pattern": true,
      "scoresheet": true,
      "patternType": "pattern",
      "pattern_type": "pattern",
      "isCustom": false,
      "association_id": "AQHA",
      "selectedAssociations": {"AQHA": true},
      "divisions": {
        "AQHA": {
          "Open Rookie": true,
          "Open Level 1 (Green Horse)": true,
          "Open Level 2": true,
          "Amateur": true,
          "Amateur Level 1": true,
          "Amateur Level 2": true,
          "Youth 13 & Under": true,
          "Youth 13 & Under Level 1": true
        }
      },
      "patternGroups": [
        {
          "id": "pg-group-1",
          "name": "Group 1",
          "divisions": [
            {"id": "AQHA-Open Rookie", "name": "Open Rookie", "group": "Open", "association_id": "AQHA", "date": "2025-01-15"},
            {"id": "AQHA-Open Level 2", "name": "Open Level 2", "group": "Open", "association_id": "AQHA", "date": "2025-01-15"},
            {"id": "AQHA-Amateur", "name": "Amateur", "group": "Amateur", "association_id": "AQHA", "date": "2025-01-15"},
            {"id": "AQHA-Amateur Level 2", "name": "Amateur Level 2", "group": "Amateur", "association_id": "AQHA", "date": "2025-01-15"}
          ]
        },
        {
          "id": "pg-group-2",
          "name": "Group 2 - L1 Classes",
          "divisions": [
            {"id": "AQHA-Open Level 1 (Green Horse)", "name": "Open Level 1 (Green Horse)", "group": "Open", "association_id": "AQHA", "date": "2025-01-16"},
            {"id": "AQHA-Amateur Level 1", "name": "Amateur Level 1", "group": "Amateur", "association_id": "AQHA", "date": "2025-01-16"},
            {"id": "AQHA-Youth 13 & Under Level 1", "name": "Youth 13 & Under Level 1", "group": "Youth", "association_id": "AQHA", "date": "2025-01-16"}
          ]
        },
        {
          "id": "pg-group-3",
          "name": "Group 3 - Youth",
          "divisions": [
            {"id": "AQHA-Youth 13 & Under", "name": "Youth 13 & Under", "group": "Youth", "association_id": "AQHA", "date": "2025-01-17"}
          ]
        }
      ]
    }
  ],
  "startDate": "2025-01-15",
  "endDate": "2025-01-18",
  "venueName": "Oklahoma City Fairgrounds",
  "venueAddress": "3001 General Pershing Blvd, Oklahoma City, OK",
  "officials": [],
  "staff": [],
  "fees": [],
  "policies": [],
  "associationJudges": [
    {"id": "judge-1", "name": "John Smith", "role": "Judge", "association_id": "AQHA"},
    {"id": "judge-2", "name": "Mary Johnson", "role": "Judge", "association_id": "AQHA"}
  ],
  "schedule": [],
  "patternDisciplines": [
    {
      "disciplineName": "Western Riding",
      "association_ids": ["AQHA"],
      "patternGroups": [
        {
          "id": "pg-group-1",
          "name": "Group 1",
          "divisions": [
            {"id": "AQHA-Open Rookie", "name": "Open Rookie", "group": "Open", "association_id": "AQHA"},
            {"id": "AQHA-Open Level 2", "name": "Open Level 2", "group": "Open", "association_id": "AQHA"},
            {"id": "AQHA-Amateur", "name": "Amateur", "group": "Amateur", "association_id": "AQHA"},
            {"id": "AQHA-Amateur Level 2", "name": "Amateur Level 2", "group": "Amateur", "association_id": "AQHA"}
          ]
        },
        {
          "id": "pg-group-2",
          "name": "Group 2 - L1 Classes",
          "divisions": [
            {"id": "AQHA-Open Level 1 (Green Horse)", "name": "Open Level 1 (Green Horse)", "group": "Open", "association_id": "AQHA"},
            {"id": "AQHA-Amateur Level 1", "name": "Amateur Level 1", "group": "Amateur", "association_id": "AQHA"},
            {"id": "AQHA-Youth 13 & Under Level 1", "name": "Youth 13 & Under Level 1", "group": "Youth", "association_id": "AQHA"}
          ]
        },
        {
          "id": "pg-group-3",
          "name": "Group 3 - Youth",
          "divisions": [
            {"id": "AQHA-Youth 13 & Under", "name": "Youth 13 & Under", "group": "Youth", "association_id": "AQHA"}
          ]
        }
      ]
    }
  ],
  "patternSelections": {},
  "disciplinePatterns": {},
  "groupDueDates": {},
  "groupStaff": {},
  "groupJudges": {},
  "currentStep": 5,
  "completedSteps": [1, 2, 3, 4]
}'::jsonb
WHERE id = '2b214343-4719-4159-923c-88fc9d23c5fe';