// ── Trend Analysis Data (ported from js/trends.js) ────────────────────────

export interface TrendData {
  subjects: string[];
  categories?: string[];
  years: Record<string, number[]>;
}

export const trendPrelimsGS1: TrendData = {
  subjects: ["History", "Geography", "Polity", "Art & Culture", "Environment", "Science & Tech", "Economics"],
  years: {
    "2013": [16, 18, 16, 9, 17, 14, 19],
    "2014": [20, 14, 14, 10, 18, 16, 10],
    "2015": [17, 16, 13, 3, 11, 8, 13],
    "2016": [15, 7, 7, 3, 18, 8, 18],
    "2017": [14, 9, 22, 5, 15, 9, 16],
    "2018": [22, 14, 13, 7, 13, 10, 18],
    "2019": [17, 14, 15, 3, 11, 7, 14],
    "2020": [20, 10, 17, 4, 10, 10, 15],
    "2021": [10, 10, 11, 5, 17, 14, 16],
    "2022": [14, 16, 15, 4, 14, 12, 14],
    "2023": [14, 16, 15, 5, 14, 12, 14],
    "2024": [3, 20, 18, 5, 14, 10, 12],
    "2025": [16, 14, 13, 14, 12, 14, 17],
  },
};

export const trendMainsGS1: TrendData = {
  subjects: ["Culture", "Freedom Struggle", "World History", "Post Independence", "Religion/Region/Empowerment", "Poverty/Population/Development", "Globalization", "Women", "Urbanization", "Climate", "Disaster", "Physical Geography", "Resources", "Industrial Locations"],
  categories: ["History", "History", "History", "History", "Society", "Society", "Society", "Society", "Society", "Geography", "Geography", "Geography", "Geography", "Geography"],
  years: {
    "2013": [20, 30, 40, 50, 10, 0, 10, 10, 10, 10, 10, 20, 20, 10],
    "2014": [40, 30, 30, 0, 10, 10, 0, 30, 0, 20, 10, 20, 20, 30],
    "2015": [25, 25, 25, 0, 37.5, 25, 12.5, 12.5, 25, 37.5, 0, 0, 25, 0],
    "2016": [5, 37.5, 12.5, 0, 37.5, 12.5, 12.5, 0, 25, 12.5, 12.5, 0, 62.5, 0],
    "2017": [10, 65, 10, 0, 50, 0, 0, 0, 15, 60, 15, 10, 0, 15],
    "2018": [35, 10, 15, 0, 35, 40, 15, 15, 15, 10, 0, 20, 10, 30],
    "2019": [10, 50, 15, 0, 35, 0, 15, 35, 15, 55, 0, 0, 10, 10],
    "2020": [50, 25, 0, 0, 3, 25, 15, 0, 15, 10, 0, 20, 45, 10],
    "2021": [10, 40, 15, 10, 0, 15, 40, 10, 15, 15, 0, 45, 35, 0],
    "2022": [40, 20, 0, 15, 40, 0, 10, 0, 10, 0, 10, 55, 50, 0],
    "2023": [40, 25, 10, 15, 40, 25, 0, 10, 15, 20, 25, 10, 15, 0],
  },
};

export const trendMainsGS2: TrendData = {
  subjects: ["Basic Structure", "Comparing", "Executive", "Legislature & Elections", "Separation of Power", "Federal/Local Body", "Statutory Bodies", "Welfare & Protection", "Poverty & Hunger", "Education/Health/HDI", "Economic Reforms", "Accountability/E-Gov", "NGO/Pressure/IAS", "Neighbours", "Non-Neighbours/Diaspora", "International Groups"],
  categories: ["Polity", "Polity", "Polity", "Polity", "Polity", "Polity", "Polity", "Welfare", "Welfare", "Welfare", "Welfare", "Governance", "Governance", "IR", "IR", "IR"],
  years: {
    "2013": [10, 0, 10, 10, 10, 30, 20, 20, 10, 20, 0, 20, 20, 50, 10, 10],
    "2014": [12.5, 0, 25, 12.5, 12.5, 12.5, 25, 25, 0, 25, 12.5, 0, 25, 12.5, 0, 50],
    "2015": [37.5, 0, 0, 0, 12.5, 25, 25, 0, 12.5, 25, 0, 25, 37.5, 25, 12.5, 12.5],
    "2016": [12.5, 0, 0, 12.5, 12.5, 37.5, 25, 0, 0, 37.5, 12.5, 25, 25, 12.5, 12.5, 25],
    "2017": [15, 0, 0, 40, 10, 10, 15, 10, 25, 10, 15, 10, 40, 10, 30, 10],
    "2018": [10, 15, 0, 20, 15, 30, 25, 10, 30, 10, 10, 25, 0, 0, 25, 25],
    "2019": [15, 10, 0, 30, 20, 15, 25, 15, 10, 10, 30, 10, 10, 0, 40, 10],
    "2020": [0, 10, 0, 35, 15, 40, 15, 0, 30, 25, 0, 20, 10, 0, 25, 25],
    "2021": [10, 15, 0, 30, 20, 25, 15, 25, 0, 10, 0, 15, 35, 25, 10, 15],
    "2022": [10, 15, 10, 30, 25, 25, 10, 10, 25, 15, 10, 0, 15, 10, 0, 40],
  },
};

export const trendMainsGS3: TrendData = {
  subjects: ["Growth", "Budget", "Liberalization", "Infra/Investment", "Food/Land Reform", "Cropping", "MSP-PDS", "E-Tech in Aid", "Food Processing", "Science & Tech", "Indian S&T", "Environment", "Disaster", "Development vs Extremism", "Border Security", "Cyber Security", "Organized Crime"],
  categories: ["Economy", "Economy", "Economy", "Economy", "Food", "Food", "Food", "Food", "Food", "Science", "Science", "Environment", "Environment", "Crime", "Crime", "Crime", "Crime"],
  years: {
    "2013": [10, 30, 20, 10, 10, 0, 20, 0, 10, 40, 0, 35, 10, 10, 10, 25, 10],
    "2014": [25, 0, 25, 37.5, 0, 0, 12.5, 0, 12.5, 12.5, 25, 25, 12.5, 0, 62.5, 0, 0],
    "2015": [37.5, 12.5, 0, 12.5, 0, 0, 0, 12.5, 37.5, 25, 12.5, 25, 12.5, 12.5, 25, 25, 0],
    "2016": [25, 12.5, 12.5, 25, 12.5, 37.5, 0, 0, 0, 0, 25, 25, 25, 12.5, 25, 12.5, 0],
    "2017": [35, 15, 15, 10, 0, 15, 15, 10, 10, 10, 25, 25, 15, 40, 0, 10, 0],
    "2018": [15, 10, 15, 25, 0, 40, 10, 0, 10, 15, 10, 35, 15, 10, 10, 15, 15],
    "2019": [25, 25, 0, 0, 0, 45, 15, 0, 15, 0, 25, 15, 35, 25, 15, 10, 0],
    "2020": [20, 15, 0, 15, 0, 30, 0, 0, 20, 35, 0, 50, 15, 15, 25, 10, 0],
    "2021": [40, 10, 0, 15, 10, 25, 0, 0, 0, 30, 0, 35, 25, 30, 10, 10, 10],
    "2022": [25, 0, 0, 10, 0, 15, 10, 0, 25, 25, 25, 40, 25, 15, 10, 15, 10],
  },
};

export const trendMainsGS4: TrendData = {
  subjects: ["Basic Theory", "EQ & Allied", "Thinkers", "Family", "Social Influence", "Attitude", "Civil Service Values", "Work Culture", "Compassion", "Public Org & Dilemma", "Code of Conduct", "Charter", "Corruption", "RTI", "IR/Funding", "Corporate"],
  categories: ["Basic", "Basic", "Basic", "Family", "Family", "Family", "Jobs", "Jobs", "Jobs", "Public", "Public", "Public", "Public", "Public", "Public", "Private"],
  years: {
    "2013": [20, 30, 30, 0, 0, 10, 25, 60, 25, 10, 0, 0, 0, 40, 0, 0],
    "2014": [10, 10, 10, 30, 0, 10, 30, 60, 0, 60, 0, 0, 10, 0, 0, 20],
    "2015": [20, 0, 20, 35, 0, 0, 40, 25, 20, 20, 0, 0, 0, 20, 10, 40],
    "2016": [20, 10, 40, 30, 10, 0, 10, 0, 20, 30, 10, 0, 25, 0, 0, 45],
    "2017": [20, 10, 10, 0, 0, 10, 30, 10, 20, 0, 0, 0, 50, 20, 10, 60],
    "2018": [20, 20, 0, 0, 0, 0, 30, 0, 40, 70, 10, 0, 30, 30, 0, 0],
    "2019": [0, 10, 30, 0, 0, 0, 30, 20, 0, 40, 40, 10, 40, 0, 10, 20],
    "2020": [0, 10, 50, 0, 30, 10, 0, 0, 40, 30, 0, 0, 20, 0, 40, 20],
    "2021": [10, 10, 30, 0, 0, 10, 40, 30, 0, 0, 0, 0, 60, 10, 10, 40],
    "2022": [20, 0, 10, 10, 0, 0, 30, 20, 0, 50, 0, 0, 40, 0, 10, 60],
  },
};
