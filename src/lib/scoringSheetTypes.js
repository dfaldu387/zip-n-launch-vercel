// The four kinds of score sheet a class can use. Set per discipline in Scoring Manager
// (scoring_rules.sheet_type) and read by the Scoring Portal to pick the right screen.
export const SHEET_TYPES = {
  general: { label: 'General Score Sheet', help: 'Start score, penalties and maneuver scores. For classes like Horsemanship, Trail and Showmanship.' },
  notes: { label: 'Live Scoring with Notes', help: 'No scores. The judge drags exhibitors into placing order and can add notes. For classes like Halter.' },
  scores: { label: 'Live Scoring with Scores/Penalties', help: 'The judge scores live, penalties are subtracted, and exhibitors move up and down the placings. For classes like Western Pleasure.' },
  time: { label: 'Live Scoring by Time', help: 'The judge types a time for each exhibitor and placings sort by time. For classes like Barrel Racing.' },
};
export const DEFAULT_SHEET_TYPE = 'general';
