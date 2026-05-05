import { disciplineLibrary, disciplineSortOrder } from './discipline_library';

const aqhaDisciplines = disciplineLibrary.filter(c => c.associations.includes('AQHA'));

export const openShowSuggestions = {
  disciplines: aqhaDisciplines
    .map(c => ({ ...c, isCustom: true, customPrice: 0 }))
    .sort((a, b) => {
        const indexA = disciplineSortOrder.indexOf(a.name);
        const indexB = disciplineSortOrder.indexOf(b.name);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.name.localeCompare(b.name);
    }),
  divisions: [
    { group: 'Open', levels: ['Open All Ages'] },
    { group: 'Amateur', levels: ['Adult 19 & Over', 'Novice Adult', 'Adult Walk-Trot'] },
    { group: 'Youth', levels: ['Youth 18 & Under', 'Youth 13 & Under', 'Novice Youth', 'Youth Walk-Trot 11-18', 'Youth Walk-Trot 10 & Under'] },
  ]
};