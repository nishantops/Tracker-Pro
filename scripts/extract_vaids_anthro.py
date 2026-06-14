"""
Extract Anthropology PYQs from Vaids-ICS-Anthropology-PYQ-Compilation.pdf
Paper 1: pages 3-23, Paper 2: pages 24-42
Format: Syllabus topic headers use X.X. numbering (1.1., 1.2., 2.1., etc.)
Questions: numbered within each topic, end with (marks/year) like (20M/2025)
"""
import pdfplumber
import re
import json

PDF_PATH = "PYQ/Vaids-ICS-Anthropology-PYQ-Compilation.pdf"

def extract_text_from_pages(pdf, start_page, end_page):
    """Extract all text from a range of pages (0-indexed)."""
    full_text = ""
    for i in range(start_page, end_page):
        page_text = pdf.pages[i].extract_text() or ""
        lines = page_text.split('\n')
        lines = [l for l in lines if 'vaidsics.com' not in l.lower() and 'This compilations is made' not in l]
        full_text += '\n'.join(lines) + '\n'
    return full_text

def parse_paper(text):
    """Parse questions from extracted text. 
    Topic headers: lines starting with X.X. pattern or single-number titles without year/marks.
    Questions: numbered lines that eventually have (XM/YYYY) pattern.
    """
    topics = []
    current_topic_name = None
    current_questions = []
    
    lines = text.split('\n')
    
    # First, join continuation lines to form complete logical lines
    # A continuation line doesn't start with a digit+period or X.X. pattern
    logical_lines = []
    topic_header_re = re.compile(r'^(\d+\.\d+\.?)\s*(.*)')
    single_num_re = re.compile(r'^(\d+)\.\s+(.*)')
    roman_re = re.compile(r'^(i{1,3}|iv|v|vi{0,3})\.\s+', re.IGNORECASE)
    sub_item_re = re.compile(r'^[a-h]\)\s+')
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        
        # Skip metadata lines
        if line.startswith('Paper') or line.startswith('Note:') or line.startswith('Anthropology UPSC') or line.startswith('(2013'):
            i += 1
            continue
        
        # Skip roman numeral items (part of topic headers like i., ii., iii.)
        if roman_re.match(line) or sub_item_re.match(line):
            # Append to previous logical line as header continuation
            if logical_lines:
                logical_lines[-1] += ' ' + line
            i += 1
            continue
        
        # If this line starts with a number pattern, it's a new logical line
        if topic_header_re.match(line) or single_num_re.match(line):
            logical_lines.append(line)
        else:
            # Continuation of previous line
            if logical_lines:
                logical_lines[-1] += ' ' + line
            i += 1
            continue
        i += 1
    
    # Now process logical lines
    year_marks_re = re.compile(r'\((\d+)\s*M\s*/?\s*(\d{4})\)')
    # Also match: (2016, 2015) or just (2013) without marks
    year_only_re = re.compile(r'\((\d{4})(?:\s*,\s*\d{4})*\)\s*$')
    
    for line in logical_lines:
        # Is this a topic header? (X.X. pattern)
        tm = topic_header_re.match(line)
        if tm:
            # It's a topic header like "1.1. Meaning, Scope and Development..."
            # Save previous topic
            if current_topic_name and current_questions:
                topics.append({"name": current_topic_name, "questions": current_questions})
            
            header_text = tm.group(2).strip()
            # Clean up: remove trailing sub-items and colons
            header_text = re.sub(r'\s+(i{1,3}|iv|v|vi{0,3})\.\s+.*$', '', header_text, flags=re.IGNORECASE)
            header_text = header_text.rstrip(':').rstrip('.').strip()
            if len(header_text) > 150:
                header_text = header_text[:147] + '...'
            current_topic_name = header_text
            current_questions = []
            continue
        
        # Single number line - could be a question or a major topic header
        sm = single_num_re.match(line)
        if sm:
            rest = sm.group(2)
            # If it has year/marks pattern or year-only pattern, it's a question
            ym = year_marks_re.search(line)
            yo = year_only_re.search(line)
            
            if ym or yo:
                # It's a question
                if ym:
                    all_matches = list(year_marks_re.finditer(line))
                    last_match = all_matches[-1]
                    marks = last_match.group(1)
                    year = last_match.group(2)
                    q_text = rest[:rest.rfind('(' + marks + 'M')].strip()
                elif yo:
                    year = yo.group(1)
                    marks = ""
                    q_text = rest[:rest.rfind('(' + year)].strip()
                
                if current_topic_name and q_text and len(q_text) > 5:
                    current_questions.append({
                        "question": q_text,
                        "year": year,
                        "marks": marks,
                        "number": str(len(current_questions) + 1)
                    })
            else:
                # No year/marks - it's likely a major topic header (like "3. Economic Organization...")
                if current_topic_name and current_questions:
                    topics.append({"name": current_topic_name, "questions": current_questions})
                header_text = rest.rstrip(':').rstrip('.').strip()
                if len(header_text) > 150:
                    header_text = header_text[:147] + '...'
                current_topic_name = header_text
                current_questions = []
    
    # Save last topic
    if current_topic_name and current_questions:
        topics.append({"name": current_topic_name, "questions": current_questions})
    
    # Post-processing: merge tiny topics (<=2 questions) whose name looks like a question
    # (contains year pattern or starts with a verb phrase) into the previous topic
    cleaned = []
    year_in_name = re.compile(r'\(\d{4}|\(\d+\s*M')
    for t in topics:
        if cleaned and len(t["questions"]) <= 2 and year_in_name.search(t["name"]):
            # This "topic" is actually a misidentified question - merge into previous
            for q in t["questions"]:
                q["number"] = str(len(cleaned[-1]["questions"]) + 1)
                cleaned[-1]["questions"].append(q)
        else:
            cleaned.append(t)
    
    return cleaned

def format_js_output(topics, var_name):
    """Format topics as JavaScript const array."""
    output = f"const {var_name} = [\n"
    for topic in topics:
        output += f'  {{"name": {json.dumps(topic["name"])}, "questions": [\n'
        for q in topic["questions"]:
            output += f'    {{"question": {json.dumps(q["question"])}, "year": "{q["year"]}", "marks": "{q["marks"]}", "number": "{q["number"]}"}},\n'
        output += "  ]},\n"
    output += "];\n"
    return output

def main():
    pdf = pdfplumber.open(PDF_PATH)
    
    # Paper 1: pages 3-23 (0-indexed: 2-22)
    print("Extracting Paper 1 (pages 3-23)...")
    p1_text = extract_text_from_pages(pdf, 2, 23)
    p1_topics = parse_paper(p1_text)
    
    # Paper 2: pages 24-42 (0-indexed: 23-41)
    print("Extracting Paper 2 (pages 24-42)...")
    p2_text = extract_text_from_pages(pdf, 23, 42)
    p2_topics = parse_paper(p2_text)
    
    # Stats
    p1_total = sum(len(t["questions"]) for t in p1_topics)
    p2_total = sum(len(t["questions"]) for t in p2_topics)
    print(f"\nPaper 1: {len(p1_topics)} topics, {p1_total} questions")
    for t in p1_topics:
        print(f"  - {t['name'][:70]}: {len(t['questions'])} Q")
    print(f"\nPaper 2: {len(p2_topics)} topics, {p2_total} questions")
    for t in p2_topics:
        print(f"  - {t['name'][:70]}: {len(t['questions'])} Q")
    
    # Write output
    js_output = format_js_output(p1_topics, "pyqVaidsAnthroP1Data")
    js_output += "\n"
    js_output += format_js_output(p2_topics, "pyqVaidsAnthroP2Data")
    
    with open("PYQ/vaids_anthro_extracted.js", "w", encoding="utf-8") as f:
        f.write(js_output)
    
    print(f"\nTotal: {p1_total + p2_total} questions extracted")
    print("Output written to PYQ/vaids_anthro_extracted.js")

if __name__ == "__main__":
    main()
