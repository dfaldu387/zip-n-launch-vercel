import { Users, Rabbit as Horse, Star, Award, School as University, Clover, Shield } from 'lucide-react';

export const miscAssociationsData = [
  { id: "multi-breed", name: "Multi-Breed Show", isGroup: true, logo: Users },
  {
    id: "versatility-ranch",
    name: "Versatility Ranch Horse",
    isGroup: true,
    price: 25000,
    logo: Horse,
    divisions: [
      { group: "Open", levels: ["Open", "Limited Open", "Rookie"] },
      { group: "Cowboy", levels: ["Cowboy"] },
      { group: "Amateur", levels: ["Amateur", "Limited Amateur", "Rookie Amateur"] },
      { group: "Youth", levels: ["Youth", "Limited Youth", "Rookie Youth"] },
    ],
    classes: [
      { name: "VRH Ranch Riding", category: "pattern_and_scoresheet", patternType: "rulebook", associations: ["versatility-ranch"] },
      { name: "VRH Ranch Trail", category: "pattern_and_scoresheet", patternType: "custom", associations: ["versatility-ranch"] },
      { name: "VRH Ranch Reining", category: "pattern_and_scoresheet", patternType: "rulebook", associations: ["versatility-ranch"] },
      { name: "VRH Ranch Cow Work", category: "scoresheet_only", patternType: "none", associations: ["versatility-ranch"] },
      { name: "VRH Ranch Cutting", category: "scoresheet_only", patternType: "none", associations: ["versatility-ranch"] },
      { name: "VRH Ranch Conformation", category: "none", patternType: "none", associations: ["versatility-ranch"] },
    ],
  },
  {
    id: "open-unaffiliated",
    name: "All Breed / Open Show",
    isOpenShow: true,
    logo: Star,
  },
  { 
    id: "ABRA", 
    name: "ABRA - American Buckskin Registry Association",
    logo: Shield,
    divisions: [
      { group: "Open", levels: ["Open"] },
      { group: "Amateur", levels: ["Amateur", "Novice Amateur"] },
      { group: "Youth", levels: ["Youth", "Novice Youth", "Walk-Trot", "Youth Walk-Trot"] },
    ]
  },
  { 
    id: "USEF", 
    name: "USEF - US Equestrian", 
    logo: Award,
    divisions: [
      { group: "Open", levels: ["Professional/Open"] },
      { group: "Amateur", levels: ["Amateur", "Amateur Owner (3’3”, 3’6”)", "Adult Amateur Hunter", "Adult Jumper", "Low/High Amateur Owner Jumper"] },
      { group: "Youth", levels: ["Junior (≤17)", "Junior Hunter (3’3”, 3’6”)", "Children’s Hunter", "Low Children's Hunter", "Pony Hunter (Small/Medium/Large)", "Children's Jumper", "Low/High Junior Jumper", "Youth Walk-Trot"] },
    ]
  },
  { 
    id: "USHJA", 
    name: "USHJA - US Hunter Jumper Association", 
    logo: Award,
    divisions: [
      { group: "Amateur", levels: ["Amateur Owner 3’3”/3’6”", "Adult Amateur"] },
      { group: "Youth", levels: ["Junior 3’3”/3’6”", "Children’s", "Low Children's", "Pony (S/M/L)", "USHJA Hunter 2’0”–3’0”", "Youth Walk-Trot"] },
    ]
  },
  { 
    id: "AHA", 
    name: "AHA - Arabian Horse Association", 
    logo: Shield,
    divisions: [
      { group: "Open", levels: ["Open"] },
      { group: "Amateur", levels: ["ATR/AATR (Amateur)", "AOTR/AAOTR (Amateur Owner)"] },
      { group: "Youth", levels: ["JTR/JOTR (Junior)", "Walk-Trot/Jog 10 & Under", "11+ W/T/J", "Youth Walk-Trot"] },
    ]
  },
  {
    id: "ISHA",
    name: "ISHA - Intercollegiate Horse Shows Association",
    logo: University,
    divisions: [
        { group: 'Hunt Seat', levels: ['Open Fences/Flat', 'Intermediate Fences/Flat', 'Limit Fences/Flat', 'Novice Flat', 'Pre-Novice Flat', 'Introductory Flat'] },
        { group: 'Western', levels: ['Open Horsemanship/Reining', 'Level II Horsemanship/Reining', 'Level I Horsemanship', 'Rookie Horsemanship', 'Beginner Horsemanship'] }
    ]
  },
  {
    id: "4-H",
    name: "4-H",
    logo: Clover,
    divisions: [
        { group: 'Age Group', levels: ['Junior (9-13)', 'Senior (14-18)'] },
        { group: 'Experience', levels: ['Novice Rider', 'Experienced Rider'] }
    ]
  },
  {
    id: "NCEA",
    name: "NCEA - National Collegiate Equestrian Association",
    logo: University,
    divisions: [
        { group: 'Discipline', levels: ['Fences', 'Flat', 'Horsemanship', 'Reining'] }
    ]
  },
  {
    id: "open-show",
    name: "Open Show (Manual Entry)",
    isOpenShow: true,
    logo: Star,
  }
];