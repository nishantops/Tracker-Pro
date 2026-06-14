const fs = require('fs');

// Load Unacademy data
let unacCode = fs.readFileSync('PYQ/unac_mains_extracted.js', 'utf8').replace(/const /g, 'var ');
eval(unacCode);

// Load existing data (for 2025 questions)
let existCode = fs.readFileSync('pyq_data.js', 'utf8').replace(/const /g, 'var ');
eval(existCode);

// Merge function
function merge(unacTopics, existTopics) {
    const extras = [];
    existTopics.forEach(t => t.questions.forEach(q => {
        if (q.year === '2024' || q.year === '2025') extras.push({ topicName: t.name, q });
    }));

    const merged = unacTopics.map(t => ({ name: t.name, questions: [...t.questions] }));

    extras.forEach(({ topicName, q }) => {
        const words = topicName.toLowerCase().split(/\s+/);
        let bestIdx = 0, bestScore = 0;
        merged.forEach((t, i) => {
            const tWords = t.name.toLowerCase().split(/\s+/);
            const overlap = words.filter(w => tWords.includes(w)).length;
            if (overlap > bestScore) { bestScore = overlap; bestIdx = i; }
        });
        const qCopy = { ...q, number: String(merged[bestIdx].questions.length + 1) };
        merged[bestIdx].questions.push(qCopy);
    });

    merged.forEach(t => t.questions.forEach((q, i) => { q.number = String(i + 1); }));
    return merged;
}

const results = {};
['GS1', 'GS2', 'GS3', 'GS4'].forEach(gs => {
    const unac = eval('pyqUnacMains' + gs + 'Data');
    const exist = eval('pyqMains' + gs + 'Data');
    results[gs] = merge(unac, exist);
    const total = results[gs].reduce((s, t) => s + t.questions.length, 0);
    const years = {};
    results[gs].forEach(t => t.questions.forEach(q => { years[q.year] = (years[q.year] || 0) + 1; }));
    console.log(gs + ': ' + results[gs].length + ' topics, ' + total + ' Q');
    console.log('  Years:', JSON.stringify(Object.fromEntries(Object.entries(years).sort())));
});

// Format as JS
function formatJS(topics, varName) {
    let out = 'const ' + varName + ' = [\n';
    topics.forEach(t => {
        out += '  {"name": ' + JSON.stringify(t.name) + ', "questions": [\n';
        t.questions.forEach(q => {
            out += '    {"question": ' + JSON.stringify(q.question) + ', "year": "' + (q.year || '') + '", "marks": "' + (q.marks || '') + '", "number": "' + q.number + '"},\n';
        });
        out += '  ]},\n';
    });
    out += '];\n';
    return out;
}

// Replace in pyq_data.js
let content = fs.readFileSync('pyq_data.js', 'utf8');
['GS1', 'GS2', 'GS3', 'GS4'].forEach(gs => {
    const varName = 'pyqMains' + gs + 'Data';
    const newJS = formatJS(results[gs], varName);
    const startMarker = 'const ' + varName + ' = [';
    const startIdx = content.indexOf(startMarker);
    if (startIdx === -1) { console.log('ERROR: not found ' + varName); return; }

    let depth = 0, endIdx = content.indexOf('[', startIdx);
    for (let i = endIdx; i < content.length; i++) {
        if (content[i] === '[') depth++;
        else if (content[i] === ']') depth--;
        if (depth === 0) { endIdx = i + 1; break; }
    }
    // Skip semicolon and whitespace
    while (endIdx < content.length && ';\n\r '.includes(content[endIdx])) endIdx++;

    content = content.substring(0, startIdx) + newJS + content.substring(endIdx);
});

fs.writeFileSync('pyq_data.js', content, 'utf8');
console.log('\nDone - pyq_data.js updated');
