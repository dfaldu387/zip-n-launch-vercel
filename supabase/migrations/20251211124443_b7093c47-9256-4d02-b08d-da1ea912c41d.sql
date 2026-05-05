-- Create APHA Western Riding project with all steps autofilled
INSERT INTO public.projects (
  id,
  user_id,
  project_name,
  project_type,
  status,
  project_data,
  created_at,
  updated_at
) VALUES (
  'b3c4d5e6-f7a8-9b0c-1d2e-3f4a5b6c7d8e',
  (SELECT id FROM auth.users LIMIT 1),
  'APHA Western Riding Championship Demo',
  'pattern_book',
  'active',
  '{
    "showName": "APHA Western Riding Championship",
    "showType": "multi-day",
    "associations": {"APHA": true},
    "customAssociations": [],
    "primaryAffiliates": [],
    "subAssociationSelections": {},
    "disciplines": [
      {
        "id": "western-riding-apha",
        "name": "Western Riding",
        "pattern": true,
        "scoresheet": true,
        "patternType": "pattern",
        "pattern_type": "pattern",
        "isCustom": false,
        "association_id": "APHA",
        "selectedAssociations": {"APHA": true},
        "divisions": {
          "APHA": {
            "Open All-Ages": true,
            "Green Horse": true,
            "Amateur (19 & Over)": true,
            "Novice Amateur": true,
            "Youth 18 & Under": true,
            "Novice Youth (18 & Under)": true,
            "Youth Walk-Trot 18 & Under": true
          }
        },
        "patternGroups": [
          {
            "id": "pg-group-1-all",
            "name": "Group 1 - ALL Classes",
            "divisions": [
              {"id": "APHA-Open All-Ages", "name": "Open All-Ages", "group": "Open", "association_id": "APHA", "date": "2025-02-10"},
              {"id": "APHA-Amateur (19 & Over)", "name": "Amateur (19 & Over)", "group": "Amateur", "association_id": "APHA", "date": "2025-02-10"},
              {"id": "APHA-Youth 18 & Under", "name": "Youth 18 & Under", "group": "Youth", "association_id": "APHA", "date": "2025-02-10"}
            ]
          },
          {
            "id": "pg-group-2-green-novice",
            "name": "Group 2 - Green/Novice",
            "divisions": [
              {"id": "APHA-Green Horse", "name": "Green Horse", "group": "Open", "association_id": "APHA", "date": "2025-02-11"},
              {"id": "APHA-Novice Amateur", "name": "Novice Amateur", "group": "Amateur", "association_id": "APHA", "date": "2025-02-11"},
              {"id": "APHA-Novice Youth (18 & Under)", "name": "Novice Youth (18 & Under)", "group": "Youth", "association_id": "APHA", "date": "2025-02-11"}
            ]
          },
          {
            "id": "pg-group-3-walktrot",
            "name": "Group 3 - Walk-Trot",
            "divisions": [
              {"id": "APHA-Youth Walk-Trot 18 & Under", "name": "Youth Walk-Trot 18 & Under", "group": "Youth", "association_id": "APHA", "date": "2025-02-12"}
            ]
          }
        ]
      }
    ],
    "startDate": "2025-02-10",
    "endDate": "2025-02-14",
    "venueName": "Fort Worth Stockyards",
    "venueAddress": "131 E Exchange Ave, Fort Worth, TX 76164",
    "officials": [
      {"name": "Sarah Thompson", "role": "Show Manager"},
      {"name": "Mike Rodriguez", "role": "Show Secretary"}
    ],
    "staff": [],
    "fees": [],
    "policies": [],
    "associationJudges": {
      "APHA": {
        "judges": [
          {"name": "David Wilson", "role": "Judge"},
          {"name": "Emily Chen", "role": "Judge"}
        ]
      }
    },
    "schedule": [],
    "patternDisciplines": [
      {
        "disciplineName": "Western Riding",
        "association_ids": ["APHA"],
        "patternGroups": [
          {
            "id": "pg-group-1-all",
            "name": "Group 1 - ALL Classes",
            "divisions": [
              {"id": "APHA-Open All-Ages", "name": "Open All-Ages", "group": "Open", "association_id": "APHA"},
              {"id": "APHA-Amateur (19 & Over)", "name": "Amateur (19 & Over)", "group": "Amateur", "association_id": "APHA"},
              {"id": "APHA-Youth 18 & Under", "name": "Youth 18 & Under", "group": "Youth", "association_id": "APHA"}
            ]
          },
          {
            "id": "pg-group-2-green-novice",
            "name": "Group 2 - Green/Novice",
            "divisions": [
              {"id": "APHA-Green Horse", "name": "Green Horse", "group": "Open", "association_id": "APHA"},
              {"id": "APHA-Novice Amateur", "name": "Novice Amateur", "group": "Amateur", "association_id": "APHA"},
              {"id": "APHA-Novice Youth (18 & Under)", "name": "Novice Youth (18 & Under)", "group": "Youth", "association_id": "APHA"}
            ]
          },
          {
            "id": "pg-group-3-walktrot",
            "name": "Group 3 - Walk-Trot",
            "divisions": [
              {"id": "APHA-Youth Walk-Trot 18 & Under", "name": "Youth Walk-Trot 18 & Under", "group": "Youth", "association_id": "APHA"}
            ]
          }
        ]
      }
    ],
    "patternSelections": {
      "0": {
        "0": {"setNumber": 1, "version": "ALL", "patternId": "pattern-1-ALL"},
        "1": {"setNumber": 1, "version": "GR/NOV", "patternId": "pattern-1-GR/NOV"},
        "2": {"setNumber": 1, "version": "Beginner", "patternId": "pattern-1-Beginner"}
      }
    },
    "disciplinePatterns": {},
    "groupDueDates": {
      "0": {
        "0": "2025-02-08",
        "1": "2025-02-09",
        "2": "2025-02-09"
      }
    },
    "groupStaff": {},
    "groupJudges": {
      "0": {
        "0": "David Wilson",
        "1": "Emily Chen",
        "2": "David Wilson"
      }
    },
    "currentStep": 5,
    "completedSteps": [1, 2, 3, 4, 5]
  }'::jsonb,
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  project_data = EXCLUDED.project_data,
  updated_at = now();

-- Also update the AQHA project pattern selections to use the new format
UPDATE public.projects 
SET project_data = project_data || '{
  "patternSelections": {
    "0": {
      "0": {"setNumber": 1, "version": "ALL", "patternId": "pattern-1-ALL"},
      "1": {"setNumber": 1, "version": "L1", "patternId": "pattern-1-L1"},
      "2": {"setNumber": 1, "version": "ALL", "patternId": "pattern-1-ALL"}
    }
  }
}'::jsonb
WHERE id = '2b214343-4719-4159-923c-88fc9d23c5fe';