"""
Merge Unacademy mains data (2013-2023) with existing data (2025) to create 
comprehensive pyqMainsGS1-4Data arrays in pyq_data.js.
"""
import json, re

def load_js_arrays(filepath, prefix):
    """Load JS arrays from file by evaluating with a hack."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract each array using regex
    arrays = {}
    for gs in ['GS1', 'GS2', 'GS3', 'GS4']:
        var_name = f'{prefix}{gs}Data'
        pattern = f'const {var_name} = '
        start = content.find(pattern)
        if start == -1:
            arrays[gs] = []
            continue
        
        # Find the array content
        bracket_start = content.index('[', start)
        depth = 0
        end = bracket_start
        for i in range(bracket_start, len(content)):
            if content[i] == '[': depth += 1
            elif content[i] == ']': depth -= 1
            if depth == 0:
                end = i + 1
                break
        
        arr_str = content[bracket_start:end]
        # Parse as JSON (arrays are JSON-compatible)
        try:
            arrays[gs] = json.loads(arr_str)
        except json.JSONDecodeError as e:
            print(f"Error parsing {var_name}: {e}")
            # Try fixing trailing commas
            fixed = re.sub(r',\s*]', ']', arr_str)
            fixed = re.sub(r',\s*}', '}', fixed)
            arrays[gs] = json.loads(fixed)
    
    return arrays

def merge_data(unac_topics, existing_topics):
    """
    Use Unacademy topics as base (better 2013-2023 coverage).
    Add 2024/2025 questions from existing data into matching topics.
    """
    # Collect 2024/2025 questions from existing
    extra_questions = []
    for topic in existing_topics:
        for q in topic['questions']:
            if q['year'] in ('2024', '2025'):
                extra_questions.append((topic['name'], q))
    
    if not extra_questions:
        return unac_topics
    
    # Try to match extra questions to Unacademy topics by keyword similarity
    merged = [dict(t) for t in unac_topics]  # deep copy
    for t in merged:
        t['questions'] = list(t['questions'])
    
    unmatched = []
    for topic_name, q in extra_questions:
        # Find best matching topic in unac data
        best_match = None
        best_score = 0
        topic_words = set(topic_name.lower().split())
        
        for i, t in enumerate(merged):
            t_words = set(t['name'].lower().split())
            overlap = len(topic_words & t_words)
            if overlap > best_score:
                best_score = overlap
                best_match = i
        
        if best_match is not None and best_score >= 1:
            # Add question to this topic
            q_copy = dict(q)
            q_copy['number'] = str(len(merged[best_match]['questions']) + 1)
            merged[best_match]['questions'].append(q_copy)
        else:
            unmatched.append((topic_name, q))
    
    # If there are unmatched questions, add them to a generic topic
    if unmatched:
        # Group by topic name
        groups = {}
        for tn, q in unmatched:
            if tn not in groups:
                groups[tn] = []
            groups[tn].append(q)
        
        for tn, qs in groups.items():
            for i, q in enumerate(qs):
                q['number'] = str(i + 1)
            merged.append({'name': tn, 'questions': qs})
    
    # Re-number all questions within each topic
    for t in merged:
        for i, q in enumerate(t['questions']):
            q['number'] = str(i + 1)
    
    return merged

def format_js_array(topics, var_name):
    """Format as JS const."""
    output = f"const {var_name} = [\n"
    for topic in topics:
        output += f'  {{"name": {json.dumps(topic["name"])}, "questions": [\n'
        for q in topic['questions']:
            output += f'    {{"question": {json.dumps(q["question"])}, "year": "{q.get("year","")}", "marks": "{q.get("marks","")}", "number": "{q["number"]}"}},\n'
        output += "  ]},\n"
    output += "];\n"
    return output

def main():
    print("Loading Unacademy data (2013-2023)...")
    unac = load_js_arrays('PYQ/unac_mains_extracted.js', 'pyqUnacMains')
    
    print("Loading existing data (has 2025)...")
    existing = load_js_arrays('pyq_data.js', 'pyqMains')
    
    # Merge
    results = {}
    for gs in ['GS1', 'GS2', 'GS3', 'GS4']:
        print(f"\nMerging {gs}...")
        merged = merge_data(unac[gs], existing[gs])
        total = sum(len(t['questions']) for t in merged)
        
        # Count by year
        years = {}
        for t in merged:
            for q in t['questions']:
                y = q.get('year', '?')
                years[y] = years.get(y, 0) + 1
        
        print(f"  {gs}: {len(merged)} topics, {total} questions")
        print(f"  Years: {dict(sorted(years.items()))}")
        results[gs] = merged
    
    # Now replace in pyq_data.js
    with open('pyq_data.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    for gs in ['GS1', 'GS2', 'GS3', 'GS4']:
        var_name = f'pyqMains{gs}Data'
        new_js = format_js_array(results[gs], var_name)
        
        # Find and replace existing array
        pattern = f'const {var_name} = ['
        start = content.find(pattern)
        if start == -1:
            print(f"ERROR: Could not find {var_name} in pyq_data.js")
            continue
        
        # Find end of array
        bracket_start = content.index('[', start)
        depth = 0
        end = bracket_start
        for i in range(bracket_start, len(content)):
            if content[i] == '[': depth += 1
            elif content[i] == ']': depth -= 1
            if depth == 0:
                end = i + 1
                break
        
        # Also include the semicolon and newline after
        while end < len(content) and content[end] in ';\n\r ':
            end += 1
        
        content = content[:start] + new_js + content[end:]
    
    with open('pyq_data.js', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("\n✓ Updated pyq_data.js with merged mains data")

if __name__ == "__main__":
    main()
