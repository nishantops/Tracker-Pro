// =========================================================================
// UPSC Tracker - Trend Analysis Data & Rendering
// =========================================================================

// Prelims GS1 Trend (Source: Unacademy - Last 12 Years)
const trendPrelimsGS1 = {
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
        "2025": [16, 14, 13, 14, 12, 14, 17]
    }
};

// Mains GS1 Trend (Source: Unacademy Booklet)
const trendMainsGS1 = {
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
        "2023": [40, 25, 10, 15, 40, 25, 0, 10, 15, 20, 25, 10, 15, 0]
    }
};

// Mains GS2 Trend (Source: Unacademy Booklet)
const trendMainsGS2 = {
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
        "2022": [10, 15, 10, 30, 25, 25, 10, 10, 25, 15, 10, 0, 15, 10, 0, 40]
    }
};

// Mains GS3 Trend (Source: Unacademy Booklet)
const trendMainsGS3 = {
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
        "2022": [25, 0, 0, 10, 0, 15, 10, 0, 25, 25, 25, 40, 25, 15, 10, 15, 10]
    }
};

// Mains GS4 Trend (Source: Unacademy Booklet)
const trendMainsGS4 = {
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
        "2022": [20, 0, 10, 10, 0, 0, 30, 20, 0, 50, 0, 0, 40, 0, 10, 60]
    }
};

// Colors for trend chart bars
const trendColors = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316',
    '#ec4899', '#14b8a6', '#84cc16', '#a855f7', '#22d3ee', '#fb923c', '#e879f9',
    '#2dd4bf', '#facc15', '#dc2626'
];

function renderTrendTable(containerId, trendData, title) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const years = Object.keys(trendData.years).sort();
    const subjects = trendData.subjects;
    const categories = trendData.categories || [];

    let html = '<div class="overflow-x-auto">';
    html += '<table class="w-full text-[11px] font-mono border-collapse">';

    // Header row
    html += '<thead><tr>';
    if (categories.length) html += '<th class="px-2 py-2 text-left font-bold text-violet-300 border-b border-violet-500/30 sticky left-0 bg-slate-900/95 z-10">Category</th>';
    html += '<th class="px-2 py-2 text-left font-bold text-violet-300 border-b border-violet-500/30 sticky ' + (categories.length ? 'left-[70px]' : 'left-0') + ' bg-slate-900/95 z-10">Topic</th>';
    years.forEach(y => {
        html += '<th class="px-2 py-2 text-center font-bold text-amber-300 border-b border-violet-500/30 min-w-[45px]">' + y.slice(-2) + '</th>';
    });
    html += '</tr></thead>';

    // Data rows
    html += '<tbody>';
    let prevCategory = '';
    subjects.forEach((subj, idx) => {
        const cat = categories[idx] || '';
        const showCat = cat !== prevCategory;
        prevCategory = cat;

        html += '<tr class="hover:bg-white/5 transition-colors">';
        if (categories.length) {
            html += '<td class="px-2 py-1.5 border-b border-slate-700/30 sticky left-0 bg-slate-900/90 z-10">';
            if (showCat) html += '<span class="text-[9px] font-black uppercase tracking-wider text-indigo-400">' + cat + '</span>';
            html += '</td>';
        }
        html += '<td class="px-2 py-1.5 border-b border-slate-700/30 font-semibold text-slate-200 sticky ' + (categories.length ? 'left-[70px]' : 'left-0') + ' bg-slate-900/90 z-10 max-w-[180px] truncate" title="' + subj + '">' + subj + '</td>';

        years.forEach(y => {
            const val = trendData.years[y][idx] || 0;
            let bgColor = 'transparent';
            let textColor = '#64748b';
            if (val > 0) {
                const intensity = Math.min(val / 60, 1);
                const r = Math.round(99 + (79 - 99) * intensity);
                const g = Math.round(102 + (70 - 102) * intensity);
                const b = Math.round(241 + (229 - 241) * intensity);
                bgColor = `rgba(99, 102, 241, ${0.1 + intensity * 0.5})`;
                textColor = intensity > 0.4 ? '#fff' : '#c7d2fe';
            }
            html += '<td class="px-1 py-1.5 text-center border-b border-slate-700/30 font-bold rounded" style="background:' + bgColor + ';color:' + textColor + '">' + (val || '-') + '</td>';
        });
        html += '</tr>';
    });
    html += '</tbody></table></div>';

    // Summary stats
    html += '<div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">';
    const lastYear = years[years.length - 1];
    const lastYearData = trendData.years[lastYear] || [];
    const topIdx = lastYearData.indexOf(Math.max(...lastYearData));
    html += '<div class="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-2 text-center"><div class="text-[9px] text-slate-400 uppercase font-bold">Latest Year</div><div class="text-sm font-black text-indigo-300">' + lastYear + '</div></div>';
    html += '<div class="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-center"><div class="text-[9px] text-slate-400 uppercase font-bold">Hottest Topic</div><div class="text-[10px] font-bold text-emerald-300 truncate">' + subjects[topIdx] + '</div></div>';
    html += '<div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-center"><div class="text-[9px] text-slate-400 uppercase font-bold">Years Covered</div><div class="text-sm font-black text-amber-300">' + years.length + '</div></div>';
    html += '<div class="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2 text-center"><div class="text-[9px] text-slate-400 uppercase font-bold">Topics Tracked</div><div class="text-sm font-black text-rose-300">' + subjects.length + '</div></div>';
    html += '</div>';

    container.innerHTML = html;
}

// Render functions called by tab activation
function renderPrelimsTrend() { renderTrendTable('trend-prelims-container', trendPrelimsGS1, 'Prelims GS1'); }
function renderMainsGS1Trend() { renderTrendTable('trend-mains-gs1-container', trendMainsGS1, 'GS1'); }
function renderMainsGS2Trend() { renderTrendTable('trend-mains-gs2-container', trendMainsGS2, 'GS2'); }
function renderMainsGS3Trend() { renderTrendTable('trend-mains-gs3-container', trendMainsGS3, 'GS3'); }
function renderMainsGS4Trend() { renderTrendTable('trend-mains-gs4-container', trendMainsGS4, 'GS4'); }
