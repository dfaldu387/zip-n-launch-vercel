export const assetData = {
  "AQHA": {
    "Ranch Riding": {
      patterns: Array.from({ length: 15 }, (_, i) => ({
        id: `aqha-rr-p${i + 1}-2025`,
        name: `2025 AQHA Ranch Riding Pattern ${i + 1}`,
        year: 2025,
        url: `/assets/aqha/ranch-riding-pattern-${i + 1}-2025.pdf`
      })),
      verbiage: Array.from({ length: 15 }, (_, i) => ({
        id: `aqha-rr-verbiage${i + 1}-2025`,
        name: `2025 AQHA Ranch Riding Verbiage ${i + 1}`,
        year: 2025,
        url: `/assets/aqha/ranch-riding-verbiage-${i + 1}-2025.pdf`,
        verbiageText: `Pattern ${i + 1}: 1. Walk from start cone to and around cone A. 2. Stop. 3. ...`
      })),
      scoreSheets: Array.from({ length: 15 }, (_, i) => ({
        id: `aqha-rr-ss-${i + 1}-2025`,
        name: `2025 AQHA Ranch Riding Score Sheet ${i + 1}`,
        year: 2025,
        url: `/assets/aqha/ranch-riding-scoresheet-${i + 1}-2025.pdf`
      }))
    },
    "Western Riding": {
      patterns: Array.from({ length: 5 }, (_, i) => ({
        id: `aqha-wr-p${i + 1}-2025`,
        name: `2025 AQHA Western Riding Pattern ${i + 1}`,
        year: 2025,
        url: `/assets/aqha/western-riding-p${i + 1}-2025.pdf`
      })),
      verbiage: Array.from({ length: 5 }, (_, i) => ({
        id: `aqha-wr-verbiage${i + 1}-2025`,
        name: `2025 AQHA Western Riding Verbiage ${i + 1}`,
        year: 2025,
        url: `/assets/aqha/western-riding-verbiage-${i + 1}-2025.pdf`,
        verbiageText: `Western Riding Pattern ${i + 1} Verbiage...`
      })),
      scoreSheets: Array.from({ length: 5 }, (_, i) => ({
        id: `aqha-wr-ss-${i + 1}-2025`,
        name: `2025 AQHA Western Riding Score Sheet ${i + 1}`,
        year: 2025,
        url: `/assets/aqha/western-riding-scoresheet-${i + 1}-2025.pdf`
      }))
    },
    "Reining": {
      patterns: Array.from({ length: 15 }, (_, i) => ({
        id: `aqha-reining-p${i + 1}-2025`,
        name: `2025 AQHA Reining Pattern ${i + 1}`,
        year: 2025,
        url: `/assets/aqha/reining-p${i + 1}-2025.pdf`
      })),
      verbiage: Array.from({ length: 15 }, (_, i) => ({
        id: `aqha-reining-verbiage${i + 1}-2025`,
        name: `2025 AQHA Reining Verbiage ${i + 1}`,
        year: 2025,
        url: `/assets/aqha/reining-verbiage-${i + 1}-2025.pdf`,
        verbiageText: `Reining Pattern ${i + 1} Verbiage...`
      })),
      scoreSheets: Array.from({ length: 15 }, (_, i) => ({
        id: `aqha-reining-ss-${i + 1}-2025`,
        name: `2025 AQHA Reining Score Sheet ${i + 1}`,
        year: 2025,
        url: `/assets/aqha/reining-scoresheet-${i + 1}-2025.pdf`
      }))
    },
    "Ranch Reining": {
      patterns: Array.from({ length: 12 }, (_, i) => ({
        id: `aqha-ranch-reining-p${i + 1}-2025`,
        name: `2025 AQHA Ranch Reining Pattern ${i + 1}`,
        year: 2025,
        url: `/assets/aqha/ranch-reining-p${i + 1}-2025.pdf`
      })),
      verbiage: Array.from({ length: 12 }, (_, i) => ({
        id: `aqha-ranch-reining-verbiage${i + 1}-2025`,
        name: `2025 AQHA Ranch Reining Verbiage ${i + 1}`,
        year: 2025,
        url: `/assets/aqha/ranch-reining-verbiage-${i + 1}-2025.pdf`,
        verbiageText: `Ranch Reining Pattern ${i + 1} Verbiage...`
      })),
      scoreSheets: Array.from({ length: 12 }, (_, i) => ({
        id: `aqha-ranch-reining-ss-${i + 1}-2025`,
        name: `2025 AQHA Ranch Reining Score Sheet ${i + 1}`,
        year: 2025,
        url: `/assets/aqha/ranch-reining-scoresheet-${i + 1}-2025.pdf`
      }))
    },
    "Working Cow Horse": {
      patterns: Array.from({ length: 12 }, (_, i) => ({
        id: `aqha-wch-p${i + 1}-2025`,
        name: `2025 AQHA Working Cow Horse Pattern ${i + 1}`,
        year: 2025,
        url: `/assets/aqha/wch-p${i + 1}-2025.pdf`
      })),
      verbiage: Array.from({ length: 12 }, (_, i) => ({
        id: `aqha-wch-verbiage${i + 1}-2025`,
        name: `2025 AQHA Working Cow Horse Verbiage ${i + 1}`,
        year: 2025,
        url: `/assets/aqha/wch-verbiage-${i + 1}-2025.pdf`,
        verbiageText: `Working Cow Horse Pattern ${i + 1} Verbiage...`
      })),
      scoreSheets: [
        { id: "aqha-wch-reined-work-ss-2025", name: "2025 AQHA Reined Work Score Sheet", year: 2025, url: "/assets/aqha/wch-reined-work-ss-2025.pdf" },
        { id: "aqha-wch-cow-work-ss-2025", name: "2025 AQHA Cow Work Score Sheet", year: 2025, url: "/assets/aqha/wch-cow-work-ss-2025.pdf" },
      ]
    },
    "Boxing": {
      patterns: [],
      verbiage: [],
      scoreSheets: [
        { id: "aqha-boxing-ss-2025", name: "2025 AQHA Boxing Score Sheet", year: 2025, url: "/assets/aqha/boxing-scoresheet-2025.pdf" },
      ]
    }
  },
  "APHA": {
    "Ranch Riding": {
      patterns: Array.from({ length: 10 }, (_, i) => ({ id: `apha-rr-p${i + 1}-2025`, name: `2025 APHA Ranch Riding Pattern ${i + 1}`, year: 2025, url: `/assets/apha/ranch-riding-p${i + 1}-2025.pdf` })),
      verbiage: Array.from({ length: 10 }, (_, i) => ({ id: `apha-rr-verbiage${i + 1}-2025`, name: `2025 APHA Ranch Riding Verbiage ${i + 1}`, year: 2025, url: `/assets/apha/ranch-riding-verbiage-${i + 1}-2025.pdf`, verbiageText: `APHA Ranch Riding Pattern ${i + 1} Verbiage...` })),
      scoreSheets: Array.from({ length: 10 }, (_, i) => ({ id: `apha-rr-ss-${i + 1}-2025`, name: `2025 APHA Ranch Riding Score Sheet ${i + 1}`, year: 2025, url: `/assets/apha/ranch-riding-ss-${i + 1}-2025.pdf` }))
    },
    "Western Riding": {
      patterns: Array.from({ length: 5 }, (_, i) => ({ id: `apha-wr-p${i + 1}-2025`, name: `2025 APHA Western Riding Pattern ${i + 1}`, year: 2025, url: `/assets/apha/western-riding-p${i + 1}-2025.pdf` })),
      verbiage: Array.from({ length: 5 }, (_, i) => ({ id: `apha-wr-verbiage${i + 1}-2025`, name: `2025 APHA Western Riding Verbiage ${i + 1}`, year: 2025, url: `/assets/apha/western-riding-verbiage-${i + 1}-2025.pdf`, verbiageText: `APHA Western Riding Pattern ${i + 1} Verbiage...` })),
      scoreSheets: Array.from({ length: 5 }, (_, i) => ({ id: `apha-wr-ss-${i + 1}-2025`, name: `2025 APHA Western Riding Score Sheet ${i + 1}`, year: 2025, url: `/assets/apha/western-riding-ss-${i + 1}-2025.pdf` }))
    },
    "Reining": {
      patterns: Array.from({ length: 15 }, (_, i) => ({ id: `apha-reining-p${i + 1}-2025`, name: `2025 APHA Reining Pattern ${i + 1}`, year: 2025, url: `/assets/apha/reining-p${i + 1}-2025.pdf` })),
      verbiage: Array.from({ length: 15 }, (_, i) => ({ id: `apha-reining-verbiage${i + 1}-2025`, name: `2025 APHA Reining Verbiage ${i + 1}`, year: 2025, url: `/assets/apha/reining-verbiage-${i + 1}-2025.pdf`, verbiageText: `APHA Reining Pattern ${i + 1} Verbiage...` })),
      scoreSheets: Array.from({ length: 15 }, (_, i) => ({ id: `apha-reining-ss-${i + 1}-2025`, name: `2025 APHA Reining Score Sheet ${i + 1}`, year: 2025, url: `/assets/apha/reining-ss-${i + 1}-2025.pdf` }))
    },
    "Ranch Reining": {
      patterns: Array.from({ length: 5 }, (_, i) => ({ id: `apha-ranch-reining-p${i + 1}-2025`, name: `2025 APHA Ranch Reining Pattern ${i + 1}`, year: 2025, url: `/assets/apha/ranch-reining-p${i + 1}-2025.pdf` })),
      verbiage: Array.from({ length: 5 }, (_, i) => ({ id: `apha-ranch-reining-verbiage${i + 1}-2025`, name: `2025 APHA Ranch Reining Verbiage ${i + 1}`, year: 2025, url: `/assets/apha/ranch-reining-verbiage-${i + 1}-2025.pdf`, verbiageText: `APHA Ranch Reining Pattern ${i + 1} Verbiage...` })),
      scoreSheets: Array.from({ length: 5 }, (_, i) => ({ id: `apha-ranch-reining-ss-${i + 1}-2025`, name: `2025 APHA Ranch Reining Score Sheet ${i + 1}`, year: 2025, url: `/assets/apha/ranch-reining-ss-${i + 1}-2025.pdf` }))
    }
  },
  "NSBA": {
    "Ranch Riding": {
      patterns: Array.from({ length: 10 }, (_, i) => ({ id: `nsba-rr-p${i + 1}-2025`, name: `2025 NSBA Ranch Riding Pattern ${i + 1}`, year: 2025, url: `/assets/nsba/ranch-riding-p${i + 1}-2025.pdf` })),
      verbiage: Array.from({ length: 10 }, (_, i) => ({ id: `nsba-rr-verbiage${i + 1}-2025`, name: `2025 NSBA Ranch Riding Verbiage ${i + 1}`, year: 2025, url: `/assets/nsba/ranch-riding-verbiage-${i + 1}-2025.pdf`, verbiageText: `NSBA Ranch Riding Pattern ${i + 1} Verbiage...` })),
      scoreSheets: Array.from({ length: 10 }, (_, i) => ({ id: `nsba-rr-ss-${i + 1}-2025`, name: `2025 NSBA Ranch Riding Score Sheet ${i + 1}`, year: 2025, url: `/assets/nsba/ranch-riding-ss-${i + 1}-2025.pdf` }))
    },
    "Western Riding": {
      patterns: Array.from({ length: 5 }, (_, i) => ({ id: `nsba-wr-p${i + 1}-2025`, name: `2025 NSBA Western Riding Pattern ${i + 1}`, year: 2025, url: `/assets/nsba/western-riding-p${i + 1}-2025.pdf` })),
      verbiage: Array.from({ length: 5 }, (_, i) => ({ id: `nsba-wr-verbiage${i + 1}-2025`, name: `2025 NSBA Western Riding Verbiage ${i + 1}`, year: 2025, url: `/assets/nsba/western-riding-verbiage-${i + 1}-2025.pdf`, verbiageText: `NSBA Western Riding Pattern ${i + 1} Verbiage...` })),
      scoreSheets: Array.from({ length: 5 }, (_, i) => ({ id: `nsba-wr-ss-${i + 1}-2025`, name: `2025 NSBA Western Riding Score Sheet ${i + 1}`, year: 2025, url: `/assets/nsba/western-riding-ss-${i + 1}-2025.pdf` }))
    },
    "Reining": {
      patterns: Array.from({ length: 15 }, (_, i) => ({ id: `nsba-reining-p${i + 1}-2025`, name: `2025 NSBA Reining Pattern ${i + 1}`, year: 2025, url: `/assets/nsba/reining-p${i + 1}-2025.pdf` })),
      verbiage: Array.from({ length: 15 }, (_, i) => ({ id: `nsba-reining-verbiage${i + 1}-2025`, name: `2025 NSBA Reining Verbiage ${i + 1}`, year: 2025, url: `/assets/nsba/reining-verbiage-${i + 1}-2025.pdf`, verbiageText: `NSBA Reining Pattern ${i + 1} Verbiage...` })),
      scoreSheets: Array.from({ length: 15 }, (_, i) => ({ id: `nsba-reining-ss-${i + 1}-2025`, name: `2025 NSBA Reining Score Sheet ${i + 1}`, year: 2025, url: `/assets/nsba/reining-ss-${i + 1}-2025.pdf` }))
    }
  },
  "ApHC": {
    "Ranch Riding": {
      patterns: Array.from({ length: 10 }, (_, i) => ({ id: `aphc-rr-p${i + 1}-2025`, name: `2025 ApHC Ranch Riding Pattern ${i + 1}`, year: 2025, url: `/assets/aphc/ranch-riding-p${i + 1}-2025.pdf` })),
      verbiage: Array.from({ length: 10 }, (_, i) => ({ id: `aphc-rr-verbiage${i + 1}-2025`, name: `2025 ApHC Ranch Riding Verbiage ${i + 1}`, year: 2025, url: `/assets/aphc/ranch-riding-verbiage-${i + 1}-2025.pdf`, verbiageText: `ApHC Ranch Riding Pattern ${i + 1} Verbiage...` })),
      scoreSheets: Array.from({ length: 10 }, (_, i) => ({ id: `aphc-rr-ss-${i + 1}-2025`, name: `2025 ApHC Ranch Riding Score Sheet ${i + 1}`, year: 2025, url: `/assets/aphc/ranch-riding-ss-${i + 1}-2025.pdf` }))
    },
    "Western Riding": {
      patterns: Array.from({ length: 5 }, (_, i) => ({ id: `aphc-wr-p${i + 1}-2025`, name: `2025 ApHC Western Riding Pattern ${i + 1}`, year: 2025, url: `/assets/aphc/western-riding-p${i + 1}-2025.pdf` })),
      verbiage: Array.from({ length: 5 }, (_, i) => ({ id: `aphc-wr-verbiage${i + 1}-2025`, name: `2025 ApHC Western Riding Verbiage ${i + 1}`, year: 2025, url: `/assets/aphc/western-riding-verbiage-${i + 1}-2025.pdf`, verbiageText: `ApHC Western Riding Pattern ${i + 1} Verbiage...` })),
      scoreSheets: Array.from({ length: 5 }, (_, i) => ({ id: `aphc-wr-ss-${i + 1}-2025`, name: `2025 ApHC Western Riding Score Sheet ${i + 1}`, year: 2025, url: `/assets/aphc/western-riding-ss-${i + 1}-2025.pdf` }))
    },
    "Reining": {
      patterns: Array.from({ length: 15 }, (_, i) => ({ id: `aphc-reining-p${i + 1}-2025`, name: `2025 ApHC Reining Pattern ${i + 1}`, year: 2025, url: `/assets/aphc/reining-p${i + 1}-2025.pdf` })),
      verbiage: Array.from({ length: 15 }, (_, i) => ({ id: `aphc-reining-verbiage${i + 1}-2025`, name: `2025 ApHC Reining Verbiage ${i + 1}`, year: 2025, url: `/assets/aphc/reining-verbiage-${i + 1}-2025.pdf`, verbiageText: `ApHC Reining Pattern ${i + 1} Verbiage...` })),
      scoreSheets: Array.from({ length: 15 }, (_, i) => ({ id: `aphc-reining-ss-${i + 1}-2025`, name: `2025 ApHC Reining Score Sheet ${i + 1}`, year: 2025, url: `/assets/aphc/reining-ss-${i + 1}-2025.pdf` }))
    },
    "Ranch Reining": {
      patterns: Array.from({ length: 5 }, (_, i) => ({ id: `aphc-ranch-reining-p${i + 1}-2025`, name: `2025 ApHC Ranch Reining Pattern ${i + 1}`, year: 2025, url: `/assets/aphc/ranch-reining-p${i + 1}-2025.pdf` })),
      verbiage: Array.from({ length: 5 }, (_, i) => ({ id: `aphc-ranch-reining-verbiage${i + 1}-2025`, name: `2025 ApHC Ranch Reining Verbiage ${i + 1}`, year: 2025, url: `/assets/aphc/ranch-reining-verbiage-${i + 1}-2025.pdf`, verbiageText: `ApHC Ranch Reining Pattern ${i + 1} Verbiage...` })),
      scoreSheets: Array.from({ length: 5 }, (_, i) => ({ id: `aphc-ranch-reining-ss-${i + 1}-2025`, name: `2025 ApHC Ranch Reining Score Sheet ${i + 1}`, year: 2025, url: `/assets/aphc/ranch-reining-ss-${i + 1}-2025.pdf` }))
    },
    "Working Cow Horse": {
      patterns: Array.from({ length: 12 }, (_, i) => ({ id: `aphc-wch-p${i + 1}-2025`, name: `2025 ApHC Working Cow Horse Pattern ${i + 1}`, year: 2025, url: `/assets/aphc/wch-p${i + 1}-2025.pdf` })),
      verbiage: Array.from({ length: 12 }, (_, i) => ({ id: `aphc-wch-verbiage${i + 1}-2025`, name: `2025 ApHC Working Cow Horse Verbiage ${i + 1}`, year: 2025, url: `/assets/aphc/wch-verbiage-${i + 1}-2025.pdf`, verbiageText: `ApHC Working Cow Horse Pattern ${i + 1} Verbiage...` })),
      scoreSheets: Array.from({ length: 12 }, (_, i) => ({ id: `aphc-wch-ss-${i + 1}-2025`, name: `2025 ApHC Working Cow Horse Score Sheet ${i + 1}`, year: 2025, url: `/assets/aphc/wch-ss-${i + 1}-2025.pdf` }))
    },
    "Boxing": {
      patterns: [],
      verbiage: [],
      scoreSheets: [{ id: "aphc-boxing-ss-2025", name: "2025 ApHC Boxing Score Sheet", year: 2025, url: "/assets/aphc/boxing-ss-2025.pdf" }]
    }
  },
  "PtHA": {
    "Ranch Riding": {
      patterns: Array.from({ length: 10 }, (_, i) => ({ id: `ptha-rr-p${i + 1}-2025`, name: `2025 PtHA Ranch Riding Pattern ${i + 1}`, year: 2025, url: `/assets/ptha/ranch-riding-p${i + 1}-2025.pdf` })),
      verbiage: Array.from({ length: 10 }, (_, i) => ({ id: `ptha-rr-verbiage${i + 1}-2025`, name: `2025 PtHA Ranch Riding Verbiage ${i + 1}`, year: 2025, url: `/assets/ptha/ranch-riding-verbiage-${i + 1}-2025.pdf`, verbiageText: `PtHA Ranch Riding Pattern ${i + 1} Verbiage...` })),
      scoreSheets: Array.from({ length: 10 }, (_, i) => ({ id: `ptha-rr-ss-${i + 1}-2025`, name: `2025 PtHA Ranch Riding Score Sheet ${i + 1}`, year: 2025, url: `/assets/ptha/ranch-riding-ss-${i + 1}-2025.pdf` }))
    },
    "Western Riding": {
      patterns: Array.from({ length: 5 }, (_, i) => ({ id: `ptha-wr-p${i + 1}-2025`, name: `2025 PtHA Western Riding Pattern ${i + 1}`, year: 2025, url: `/assets/ptha/western-riding-p${i + 1}-2025.pdf` })),
      verbiage: Array.from({ length: 5 }, (_, i) => ({ id: `ptha-wr-verbiage${i + 1}-2025`, name: `2025 PtHA Western Riding Verbiage ${i + 1}`, year: 2025, url: `/assets/ptha/western-riding-verbiage-${i + 1}-2025.pdf`, verbiageText: `PtHA Western Riding Pattern ${i + 1} Verbiage...` })),
      scoreSheets: Array.from({ length: 5 }, (_, i) => ({ id: `ptha-wr-ss-${i + 1}-2025`, name: `2025 PtHA Western Riding Score Sheet ${i + 1}`, year: 2025, url: `/assets/ptha/western-riding-ss-${i + 1}-2025.pdf` }))
    },
    "Reining": {
      patterns: Array.from({ length: 15 }, (_, i) => ({ id: `ptha-reining-p${i + 1}-2025`, name: `2025 PtHA Reining Pattern ${i + 1}`, year: 2025, url: `/assets/ptha/reining-p${i + 1}-2025.pdf` })),
      verbiage: Array.from({ length: 15 }, (_, i) => ({ id: `ptha-reining-verbiage${i + 1}-2025`, name: `2025 PtHA Reining Verbiage ${i + 1}`, year: 2025, url: `/assets/ptha/reining-verbiage-${i + 1}-2025.pdf`, verbiageText: `PtHA Reining Pattern ${i + 1} Verbiage...` })),
      scoreSheets: Array.from({ length: 15 }, (_, i) => ({ id: `ptha-reining-ss-${i + 1}-2025`, name: `2025 PtHA Reining Score Sheet ${i + 1}`, year: 2025, url: `/assets/ptha/reining-ss-${i + 1}-2025.pdf` }))
    },
    "Ranch Reining": {
      patterns: Array.from({ length: 5 }, (_, i) => ({ id: `ptha-ranch-reining-p${i + 1}-2025`, name: `2025 PtHA Ranch Reining Pattern ${i + 1}`, year: 2025, url: `/assets/ptha/ranch-reining-p${i + 1}-2025.pdf` })),
      verbiage: Array.from({ length: 5 }, (_, i) => ({ id: `ptha-ranch-reining-verbiage${i + 1}-2025`, name: `2025 PtHA Ranch Reining Verbiage ${i + 1}`, year: 2025, url: `/assets/ptha/ranch-reining-verbiage-${i + 1}-2025.pdf`, verbiageText: `PtHA Ranch Reining Pattern ${i + 1} Verbiage...` })),
      scoreSheets: Array.from({ length: 5 }, (_, i) => ({ id: `ptha-ranch-reining-ss-${i + 1}-2025`, name: `2025 PtHA Ranch Reining Score Sheet ${i + 1}`, year: 2025, url: `/assets/ptha/ranch-reining-ss-${i + 1}-2025.pdf` }))
    },
    "Working Cow Horse": {
      patterns: Array.from({ length: 12 }, (_, i) => ({ id: `ptha-wch-p${i + 1}-2025`, name: `2025 PtHA Working Cow Horse Pattern ${i + 1}`, year: 2025, url: `/assets/ptha/wch-p${i + 1}-2025.pdf` })),
      verbiage: Array.from({ length: 12 }, (_, i) => ({ id: `ptha-wch-verbiage${i + 1}-2025`, name: `2025 PtHA Working Cow Horse Verbiage ${i + 1}`, year: 2025, url: `/assets/ptha/wch-verbiage-${i + 1}-2025.pdf`, verbiageText: `PtHA Working Cow Horse Pattern ${i + 1} Verbiage...` })),
      scoreSheets: Array.from({ length: 12 }, (_, i) => ({ id: `ptha-wch-ss-${i + 1}-2025`, name: `2025 PtHA Working Cow Horse Score Sheet ${i + 1}`, year: 2025, url: `/assets/ptha/wch-ss-${i + 1}-2025.pdf` }))
    },
    "Boxing": {
      patterns: [],
      verbiage: [],
      scoreSheets: [{ id: "ptha-boxing-ss-2025", name: "2025 PtHA Boxing Score Sheet", year: 2025, url: "/assets/ptha/boxing-ss-2025.pdf" }]
    }
  }
};