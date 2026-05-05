export const scoreSheetTemplates = {
    "AQHA": {
        "Trail": {
            2024: { path: "/templates/scoresheets/AQHA_Trail_2024.pdf", layout: '15box_3x5' }
        },
        "Western Horsemanship": {
            2024: { path: "/templates/scoresheets/AQHA_Horsemanship_2024.pdf", layout: '15box_3x5' }
        },
        "Ranch Riding": {
            2024: { path: "/templates/scoresheets/AQHA_RanchRiding_2024.pdf", layout: '10box_2col' }
        }
    },
    "AHA": {
        "Trail": {
            2024: { path: "/templates/scoresheets/AHA_Trail_2024.pdf", layout: '15box_3x5' }
        },
        "Western Horsemanship": {
            2024: { path: "/templates/scoresheets/AHA_Horsemanship_2024.pdf", layout: '15box_3x5' }
        }
    },
    "NSBA": {
        "Trail": {
            2024: { path: "/templates/scoresheets/NSBA_Trail_2024.pdf", layout: '15box_3x5' }
        }
    }
};

export const simulatedNewTemplates = [
    { association: "AQHA", className: "Trail", year: 2025, data: { path: "/templates/scoresheets/AQHA_Trail_2025.pdf", layout: '15box_3x5' } },
    { association: "AHA", className: "Western Horsemanship", year: 2025, data: { path: "/templates/scoresheets/AHA_Horsemanship_2025.pdf", layout: '15box_3x5' } },
    { association: "NSBA", className: "Trail", year: 2025, data: { path: "/templates/scoresheets/NSBA_Trail_2025.pdf", layout: '15box_3x5' } },
];