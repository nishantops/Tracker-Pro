import fitz
import re
import json

GS1_PDF = r'C:\Users\nishantkumar04\Downloads\Previous-Papers-Prelims-GS-Topicwise-English-1.pdf'
CSAT_PDF = r'C:\Users\nishantkumar04\Downloads\Topicwise-CSAT-PYQs-2011-2025-1.pdf'
PAGE_OFFSET_GS1 = 6  # pdf_index = printed_page + 5 (printed 2 = index 7)
PAGE_OFFSET_CSAT = -1  # pdf_index = printed_page - 1 (printed 4 = index 3)

# ========== GS1 TOPICS ==========
GS1_TOPICS = [
    {
        "name": "Modern India",
        "subtopics": [
            {"name": "India in the 18th Century", "pages": [2, 4]},
            {"name": "Indian Renaissance and Reform Movements", "pages": [5, 6]},
            {"name": "Early Uprising Against the British and Revolt of 1857", "pages": [7, 8]},
            {"name": "Rise of Indian National Movement: Moderate and Extremists Phase", "pages": [9, 11]},
            {"name": "Phases of Revolutionary Nationalism", "pages": [12, 13]},
            {"name": "The Beginning of Gandhian Era", "pages": [14, 18]},
            {"name": "The National Movement in the 1940s", "pages": [19, 20]},
            {"name": "Development of Press, Education and Civil Services", "pages": [21, 22]},
            {"name": "Independence to Partition", "pages": [23, 24]},
        ]
    },
    {
        "name": "Ancient India",
        "subtopics": [
            {"name": "Prehistoric Period and Indus Valley Civilisation", "pages": [26, 27]},
            {"name": "Vedic and Later Vedic Age", "pages": [28, 29]},
            {"name": "Mauryan and Post-Mauryan Age", "pages": [30, 34]},
            {"name": "Gupta and Post-Gupta Age", "pages": [35, 37]},
            {"name": "Sangam Age", "pages": [38, 39]},
        ]
    },
    {
        "name": "Medieval India",
        "subtopics": [
            {"name": "Delhi Sultanate (1206 AD to 1526 AD)", "pages": [41, 42]},
            {"name": "Mughal Empire (1526 AD to 1761 AD)", "pages": [43, 44]},
            {"name": "Provincial Kingdoms in Medieval India", "pages": [45, 46]},
            {"name": "Religious Movement During Medieval Period", "pages": [47, 48]},
        ]
    },
    {
        "name": "Art & Culture",
        "subtopics": [
            {"name": "Architecture and Sculpture", "pages": [50, 52]},
            {"name": "Literature: Religious and Scientific", "pages": [53, 54]},
            {"name": "Performing Arts: Dance, Theatre and Music", "pages": [55, 56]},
            {"name": "Visual Arts: Painting, Ceramics and Drawing", "pages": [57, 58]},
            {"name": "Indian Philosophy and Bhakti & Sufi Movements", "pages": [59, 60]},
            {"name": "Indian Traditions, Festivals, and Calendars", "pages": [61, 62]},
            {"name": "Miscellaneous", "pages": [63, 65]},
        ]
    },
    {
        "name": "World Geography",
        "subtopics": [
            {"name": "The Earth and the Universe", "pages": [67, 69]},
            {"name": "Geomorphology", "pages": [70, 72]},
            {"name": "Climatology", "pages": [73, 75]},
            {"name": "Oceanography", "pages": [76, 77]},
            {"name": "World Climatic Regions", "pages": [78, 79]},
            {"name": "Human and Economic Geography", "pages": [80, 81]},
            {"name": "World Map", "pages": [82, 84]},
        ]
    },
    {
        "name": "Indian Geography",
        "subtopics": [
            {"name": "Physiography of India", "pages": [86, 87]},
            {"name": "Drainage System of India", "pages": [88, 90]},
            {"name": "Indian Climate", "pages": [91, 92]},
            {"name": "Soils", "pages": [93, 94]},
            {"name": "Natural Vegetation in India", "pages": [95, 96]},
            {"name": "Mineral and Industries", "pages": [97, 99]},
            {"name": "Agriculture in India", "pages": [100, 102]},
            {"name": "Indian Map", "pages": [103, 105]},
        ]
    },
    {
        "name": "Environment & Ecology and Disaster Management",
        "subtopics": [
            {"name": "Protected Area Network: NP, WS, BR, etc.", "pages": [107, 108]},
            {"name": "Ecosystem and Ecology", "pages": [109, 114]},
            {"name": "Environmental Pollution", "pages": [115, 119]},
            {"name": "Biodiversity", "pages": [120, 125]},
            {"name": "Global Conservation Efforts", "pages": [126, 131]},
            {"name": "National Conservation Efforts", "pages": [132, 136]},
            {"name": "Climate Change: Causes and Implications", "pages": [137, 141]},
            {"name": "Environment, Sustainable Development and General Issues", "pages": [142, 144]},
            {"name": "Agriculture", "pages": [145, 149]},
        ]
    },
    {
        "name": "Indian Polity and Governance",
        "subtopics": [
            {"name": "Historical Background & Making of Indian Constitution", "pages": [151, 153]},
            {"name": "Features of the Indian Constitution", "pages": [154, 161]},
            {"name": "Legislature", "pages": [162, 171]},
            {"name": "Executive", "pages": [172, 176]},
            {"name": "Judiciary", "pages": [177, 180]},
            {"name": "Local Self Government", "pages": [181, 183]},
            {"name": "Governance", "pages": [184, 187]},
            {"name": "Constitutional and Non-constitutional Bodies", "pages": [188, 190]},
            {"name": "Judicial & Quasi-Judicial Bodies", "pages": [191, 192]},
        ]
    },
    {
        "name": "International Relations",
        "subtopics": [
            {"name": "India's Foreign Policy", "pages": [194, 195]},
            {"name": "India & Its Neighbors", "pages": [196, 197]},
            {"name": "International Groups and Political Organizations", "pages": [198, 202]},
            {"name": "Places in News", "pages": [203, 205]},
        ]
    },
    {
        "name": "Indian Economy",
        "subtopics": [
            {"name": "Money: Barter to Bitcoins", "pages": [207, 208]},
            {"name": "Bank Classification", "pages": [209, 214]},
            {"name": "NPA, Bad-Loans, BASEL", "pages": [215, 218]},
            {"name": "Sharemarket, Companies Act", "pages": [219, 223]},
            {"name": "Insurance, Pension, Financial Inclusion", "pages": [224, 227]},
            {"name": "Budget Direct Taxes", "pages": [228, 229]},
            {"name": "Budget Indirect Taxes GST", "pages": [230, 231]},
            {"name": "Finance Commission, BlackMoney, Subsidies", "pages": [232, 233]},
            {"name": "BoP, CAD Currency Exchange", "pages": [234, 239]},
            {"name": "WTO, IMF & other International Organisations & Agreements", "pages": [240, 243]},
            {"name": "Sectors of Economy - Agriculture", "pages": [244, 248]},
            {"name": "Sectors - MFG, Services, Ease of Doing Biz, IPR, Startup, MSME", "pages": [249, 252]},
            {"name": "NITI, Planning Commission, FYP, Unemployment", "pages": [253, 256]},
            {"name": "GDP, GNP", "pages": [257, 258]},
            {"name": "Inflation", "pages": [259, 261]},
            {"name": "Infra: Energy", "pages": [262, 264]},
            {"name": "Infra: Transport, Urban Rural, Communication, Investment, PPP", "pages": [265, 268]},
            {"name": "HRD: Census, Health Hunger", "pages": [269, 270]},
            {"name": "HRD: Education and Skill", "pages": [271, 272]},
            {"name": "HRD: Poverty", "pages": [273, 274]},
            {"name": "HRD: Weaker Section, HDI, SDG", "pages": [275, 276]},
            {"name": "Microeconomics", "pages": [277, 278]},
        ]
    },
    {
        "name": "Science & Tech and Basic Science",
        "subtopics": [
            {"name": "Biotechnology", "pages": [280, 284]},
            {"name": "Defence Technology", "pages": [285, 286]},
            {"name": "Space Science", "pages": [287, 291]},
            {"name": "Communication Technology", "pages": [292, 296]},
            {"name": "Energy", "pages": [297, 298]},
            {"name": "Miscellaneous", "pages": [299, 302]},
            {"name": "Physics", "pages": [303, 305]},
            {"name": "Chemistry", "pages": [306, 307]},
            {"name": "Biology", "pages": [308, 311]},
        ]
    },
    {
        "name": "Current Affairs and Miscellaneous",
        "subtopics": [
            {"name": "Current Affairs: India", "pages": [313, 325]},
            {"name": "Current Affairs: World", "pages": [326, 333]},
            {"name": "GK/Persons in News", "pages": [334, 335]},
            {"name": "Miscellaneous", "pages": [336, 340]},
        ]
    },
]

# ========== CSAT TOPICS ==========
# TOC: printed pages. pdf_index = printed_page - 1
CSAT_TOPICS = [
    {
        "name": "Comprehension",
        "subtopics": [{"name": "Reading Comprehension", "pages": [4, 115]}]
    },
    {
        "name": "Interpersonal Skills, Communication Skills",
        "subtopics": [{"name": "General", "pages": [116, 117]}]
    },
    {
        "name": "Logical Reasoning and Analytical Ability",
        "subtopics": [{"name": "General", "pages": [118, 175]}]
    },
    {
        "name": "Decision-Making and Problem-Solving",
        "subtopics": [{"name": "General", "pages": [176, 181]}]
    },
    {
        "name": "General Mental Ability",
        "subtopics": [{"name": "General", "pages": [182, 202]}]
    },
    {
        "name": "Basic Numeracy",
        "subtopics": [{"name": "General", "pages": [203, 243]}]
    },
    {
        "name": "Arithmetic",
        "subtopics": [{"name": "General", "pages": [244, 261]}]
    },
    {
        "name": "Geometry & Mensuration",
        "subtopics": [{"name": "General", "pages": [262, 267]}]
    },
    {
        "name": "Permutation, Combination & Probability",
        "subtopics": [{"name": "General", "pages": [268, 274]}]
    },
    {
        "name": "Time and Distance & Time and Work",
        "subtopics": [{"name": "General", "pages": [275, 283]}]
    },
    {
        "name": "Data Interpretation",
        "subtopics": [{"name": "General", "pages": [284, 301]}]
    },
]


def format_question_text(raw_text):
    """
    Format question text preserving numbered statements on new lines.
    Detects if question has a list (1. 2. 3. or I. II. III.) and adds <br> before each item.
    Also adds <br> before the trailing question phrase after the last statement.
    """
    text = raw_text.strip()
    
    # Detect if this question has numbered statements (1. X... 2. Y...)
    # A numbered list has at least "1." followed by "2." in the text
    has_numbered = bool(re.search(r'\b1\.\s+[A-Z]', text) and re.search(r'\b2\.\s+[A-Z]', text))
    
    # Detect Roman numeral lists (I. X... II. Y...)
    has_roman = bool(re.search(r'\bI\.\s+[A-Z]', text) and re.search(r'\bII\.\s+[A-Z]', text))
    
    # Detect Statement-I/II pattern
    has_statement = bool(re.search(r'Statement-I', text))
    
    if has_numbered:
        # Add <br> before "N. [A-Z]" patterns (but not at the very start)
        text = re.sub(r'(?<=\S) (\d+)\. (?=[A-Z])', r'<br>\1. ', text)
    
    if has_roman:
        # Add <br> before Roman numeral items: I. II. III. IV. V. VI.
        text = re.sub(r'(?<=\S) (I{1,3}|IV|VI{0,3}|V)\. (?=[A-Z])', r'<br>\1. ', text)
    
    if has_statement:
        # Add <br> before Statement-I: Statement-II: etc.
        text = re.sub(r'(?<=\S) (Statement-I{1,3}V?|Statement-IV|Statement-V?I{0,3}):', r'<br>\1:', text)
    
    # Add <br> before trailing question phrases that come after statements
    if has_numbered or has_roman or has_statement:
        trailing_patterns = [
            r'Which of the statements given above',
            r'Which of the above statements',
            r'Which of the above',
            r'Which of the pairs given above',
            r'Which one of the following',
            r'Select the correct answer',
            r'How many of the above',
            r'The correct answer',
            r'Based on the above',
            r'In the light of the above',
            r'With reference to the above',
        ]
        for pat in trailing_patterns:
            text = re.sub(r'(?<=\S) (' + pat + ')', r'<br>\1', text)
    
    # Clean up: remove <br> if at the very start
    text = re.sub(r'^<br>', '', text)
    
    return text


def parse_questions_stateful_gs1(lines):
    """
    GS1 parser: uses option (d) as question END marker.
    A line starting with \\d+.\\t AFTER a (d) line = new question start.
    """
    questions = []
    current_q_num = 0
    current_q_lines = []
    saw_option_d = True
    
    filtered_lines = []
    for line in lines:
        stripped = line.strip()
        if re.match(r'^\d{1,3}$', stripped):
            continue
        filtered_lines.append(line)
    
    for line in filtered_lines:
        stripped = line.strip()
        if not stripped:
            if current_q_lines:
                current_q_lines.append(line)
            continue
        
        q_start_match = re.match(r'^(\d+)\.\t', line)
        
        if q_start_match and saw_option_d:
            num = int(q_start_match.group(1))
            if current_q_lines and current_q_num > 0:
                q = parse_single_question_gs1(current_q_lines, current_q_num)
                if q:
                    questions.append(q)
            current_q_num = num
            current_q_lines = [line]
            saw_option_d = False
            continue
        
        if current_q_lines:
            current_q_lines.append(line)
        
        if re.match(r'^\(d\)\s+\S', line) or re.match(r'^\(d\)\t', line):
            saw_option_d = True
    
    if current_q_lines and current_q_num > 0:
        q = parse_single_question_gs1(current_q_lines, current_q_num)
        if q:
            questions.append(q)
    
    return questions


def extract_year_from_text(text):
    """
    Extract year from various formats found in the PDF:
    - (2023) standalone or inline
    - [2017] or [2018-I] square brackets
    - (UPSC-Prelims-2020), (Prelims-2016), (UPSC-2022)
    - [asked in UPSC- Prelims-2017], (Asked in UPSC-Pre-2016)
    - (Pre18 Set-D) short prelims year format
    """
    # Standard: (20XX)
    m = re.search(r'\(20[12]\d\)', text)
    if m:
        return m.group(0).strip('()')
    
    # Square brackets: [2017], [2018-I], [2016-I]
    m = re.search(r'\[(20[12]\d)(?:-I{1,2})?\]', text)
    if m:
        return m.group(1)
    
    # Short prelims format: (Pre18 Set-D) or (Pre16 Set-A)
    m = re.search(r'\(Pre(\d{2})\b', text)
    if m:
        return '20' + m.group(1)
    
    # UPSC format: (UPSC-Prelims-YYYY), (UPSC- Prelims-YYYY), (UPSC-Pre-YYYY)
    m = re.search(r'\(UPSC-?\s*(?:Prelims|Pre)-?\s*(\d{4})\)', text, re.IGNORECASE)
    if m:
        return m.group(1)
    
    # Prelims format: (Prelims-YYYY)
    m = re.search(r'\(Prelims-?\s*(\d{4})\)', text, re.IGNORECASE)
    if m:
        return m.group(1)
    
    # UPSC year: (UPSC-YYYY) or (UPSC- YYYY)
    m = re.search(r'\(UPSC-?\s*(\d{4})\)', text, re.IGNORECASE)
    if m:
        return m.group(1)
    
    # Square brackets with text: [asked in UPSC-Prelims-2017]
    m = re.search(r'\[.*?(20[12]\d).*?\]', text)
    if m:
        return m.group(1)
    
    return ""


def parse_single_question_gs1(lines, q_num):
    """Parse a single GS1 question preserving statement structure."""
    text = '\n'.join(lines)
    
    # Extract year from various formats
    year = extract_year_from_text(text)
    
    # Also check for standalone year on lines like just "(2025)" or "2025"
    if not year:
        for line in lines:
            m = re.match(r'^\s*\(?(20[12]\d)\)?\s*$', line.strip())
            if m:
                year = m.group(1)
                break
    
    opt_a_match = re.search(r'\n\(a\)\s+', text)
    if not opt_a_match:
        opt_a_match = re.search(r'\(a\)\s+', text)
    
    if not opt_a_match:
        return None
    
    q_text_raw = text[:opt_a_match.start()]
    options_raw = text[opt_a_match.start():]
    
    # Remove the leading "N.\t"
    q_text_raw = re.sub(r'^\d+\.\t\s*', '', q_text_raw)
    # Remove all year marker formats from question text
    q_text_raw = re.sub(r'\(20[12]\d\)', '', q_text_raw)
    q_text_raw = re.sub(r'\[(?:asked in )?UPSC-?\s*(?:Prelims|Pre)?-?\s*\d{4}(?:-I{1,2})?\]', '', q_text_raw, flags=re.IGNORECASE)
    q_text_raw = re.sub(r'\[\d{4}(?:-I{1,2})?\]', '', q_text_raw)
    q_text_raw = re.sub(r'\((?:Asked in )?UPSC-?\s*(?:Prelims|Pre)?-?\s*\d{4}\)', '', q_text_raw, flags=re.IGNORECASE)
    q_text_raw = re.sub(r'\(Prelims-?\s*\d{4}\)', '', q_text_raw, flags=re.IGNORECASE)
    q_text_raw = re.sub(r'\(Pre\d{2}\s*(?:Set-?[A-D])?\)', '', q_text_raw, flags=re.IGNORECASE)
    # Replace tabs with spaces
    q_text_raw = re.sub(r'\t+', ' ', q_text_raw)
    # Replace newlines with spaces (but we'll add <br> for statements later)
    q_text_raw = re.sub(r'\n+', ' ', q_text_raw)
    # Collapse multiple spaces
    q_text_raw = re.sub(r'\s+', ' ', q_text_raw).strip()
    
    # Now format with <br> for numbered statements
    q_text_raw = format_question_text(q_text_raw)
    
    # Parse options
    options = {}
    opt_parts = re.split(r'\(([a-d])\)\s+', options_raw)
    for j in range(1, len(opt_parts), 2):
        if j + 1 < len(opt_parts):
            letter = opt_parts[j]
            val = opt_parts[j + 1]
            val = re.sub(r'[\t\n]+', ' ', val)
            val = re.sub(r'\s+', ' ', val).strip()
            options[letter] = val
    
    if not q_text_raw or len(q_text_raw) < 10:
        return None
    
    return {
        "number": q_num,
        "year": year,
        "question": q_text_raw,
        "options": options
    }


def parse_answers_gs1(lines):
    """Parse answers from GS1 explanation pages. Handles Answer: X (dropped).
    Also extracts year info if present near answers."""
    answers = {}
    answer_years = {}
    text = '\n'.join(lines)
    # Pattern: number. Answer: (letter) OR Answer: X
    matches = re.findall(r'(\d+)\.\s+Answer:\s*\(?([a-dxX])\)?', text)
    for num, letter in matches:
        answers[int(num)] = letter.lower()
    
    # Try to find year markers near question numbers on explanation pages
    # Pattern: year appears before or after the answer line
    year_matches = re.findall(r'(\d+)\.\s+.*?\(20([12]\d)\)', text)
    for num, yr in year_matches:
        answer_years[int(num)] = '20' + yr
    
    return answers, answer_years


def parse_questions_csat(lines):
    """
    CSAT parser: questions start with N.\\t or N.\\n pattern.
    Options use (a)\\t or (a)      format.
    Year format: (CSAT-YYYY)
    """
    questions = []
    current_q_num = 0
    current_q_lines = []
    saw_option_d = True
    
    filtered_lines = []
    for line in lines:
        stripped = line.strip()
        # Skip standalone page numbers
        if re.match(r'^\d{1,3}$', stripped):
            continue
        # Skip topic headers (appear as standalone known topic names)
        if stripped in ['Comprehension', 'Interpersonal Skills, Communication Skills',
                       'Logical Reasoning and Analytical Ability',
                       'Decision-Making and Problem-Solving',
                       'General Mental Ability', 'Basic Numeracy', 'Arithmetic',
                       'Geometry & Mensuration', 'Permutation, Combination & Probability',
                       'Time and Distance & Time and Work', 'Data Interpretation']:
            continue
        # Skip known subtopic headers
        if stripped in ['Numbers and their relations', 'Orders of magnitude', 'Miscellaneous',
                       'Reading Comprehension']:
            continue
        filtered_lines.append(line)
    
    for line in filtered_lines:
        stripped = line.strip()
        if not stripped:
            if current_q_lines:
                current_q_lines.append(line)
            continue
        
        # CSAT question start: N.\t or N. at start of line (with tab)
        q_start_match = re.match(r'^(\d+)\.\t', line)
        
        if q_start_match and saw_option_d:
            num = int(q_start_match.group(1))
            if current_q_lines and current_q_num > 0:
                q = parse_single_question_csat(current_q_lines, current_q_num)
                if q:
                    questions.append(q)
            current_q_num = num
            current_q_lines = [line]
            saw_option_d = False
            continue
        
        if current_q_lines:
            current_q_lines.append(line)
        
        # Check for option (d) - marks end of question
        if re.match(r'^\(d\)\s+\S', line) or re.match(r'^\(d\)\t', line):
            saw_option_d = True
    
    if current_q_lines and current_q_num > 0:
        q = parse_single_question_csat(current_q_lines, current_q_num)
        if q:
            questions.append(q)
    
    return questions


def parse_single_question_csat(lines, q_num):
    """Parse a single CSAT question."""
    text = '\n'.join(lines)
    
    # Extract year - CSAT format: (CSAT-YYYY) or standalone line
    year_match = re.search(r'\(CSAT-(\d{4})\)', text)
    year = year_match.group(1) if year_match else ""
    
    if not year:
        for line in lines:
            m = re.match(r'^\s*\(?CSAT-(\d{4})\)?\s*$', line.strip())
            if m:
                year = m.group(1)
                break
    
    # Find options section
    opt_a_match = re.search(r'\n\(a\)\s+', text)
    if not opt_a_match:
        opt_a_match = re.search(r'\(a\)\s+', text)
    
    if not opt_a_match:
        return None
    
    q_text_raw = text[:opt_a_match.start()]
    options_raw = text[opt_a_match.start():]
    
    # Clean question text
    q_text_raw = re.sub(r'^\d+\.\t\s*', '', q_text_raw)
    q_text_raw = re.sub(r'\(CSAT-\d{4}\)', '', q_text_raw)
    q_text_raw = re.sub(r'\t+', ' ', q_text_raw)
    q_text_raw = re.sub(r'\n+', ' ', q_text_raw)
    q_text_raw = re.sub(r'\s+', ' ', q_text_raw).strip()
    
    # Format with <br> for numbered statements
    q_text_raw = format_question_text(q_text_raw)
    
    # Parse options
    options = {}
    opt_parts = re.split(r'\(([a-d])\)\s+', options_raw)
    for j in range(1, len(opt_parts), 2):
        if j + 1 < len(opt_parts):
            letter = opt_parts[j]
            val = opt_parts[j + 1]
            val = re.sub(r'[\t\n]+', ' ', val)
            val = re.sub(r'\s+', ' ', val).strip()
            # Remove trailing (CSAT-YYYY) from option text
            val = re.sub(r'\(CSAT-\d{4}\)\s*$', '', val).strip()
            options[letter] = val
    
    if not q_text_raw or len(q_text_raw) < 10:
        return None
    
    return {
        "number": q_num,
        "year": year,
        "question": q_text_raw,
        "options": options
    }


def parse_answers_csat(lines):
    """Parse answers from CSAT explanation pages. Handles multiple formats:
    - N.\tAnswer: (x) or Answer: X
    - N.\t\\nAnswer: C (uppercase, no parens)
    - N.\t\\nAnswer D (no colon)
    - N.\tAnswer: The correct option is option (x)
    - N.\tSolution: (x)
    """
    answers = {}
    text = '\n'.join(lines)
    
    # Pattern 1: N. Answer/Solution: (letter) - standard format
    matches = re.findall(r'(\d+)\.\s+(?:Answer|Solution):\s*\(?([a-dA-DxX])\)?', text)
    for num, letter in matches:
        answers[int(num)] = letter.lower()
    
    # Pattern 2: N.\t\nAnswer: letter or Answer letter (on next line after number)
    matches2 = re.findall(r'(\d+)\.\t\s*\n\s*Answer:?\s*\(?([a-dA-D])\)?', text)
    for num, letter in matches2:
        if int(num) not in answers:
            answers[int(num)] = letter.lower()
    
    # Pattern 3: "Answer: The correct option is option (x)" or "is (x)"
    matches3 = re.findall(r'(\d+)\.\s+(?:Answer|Solution):\s*(?:The correct option is (?:option\s*)?)?\(?([a-dA-D])\)?', text, re.IGNORECASE)
    for num, letter in matches3:
        if int(num) not in answers:
            answers[int(num)] = letter.lower()
    
    # Pattern 4: "N.\tAnswer: (x) is correct" 
    matches4 = re.findall(r'(\d+)\.\s+(?:Answer|Solution):\s*\(?([a-dA-D])\)?\s*is correct', text, re.IGNORECASE)
    for num, letter in matches4:
        if int(num) not in answers:
            answers[int(num)] = letter.lower()
    
    return answers


def parse_comprehension_questions(lines):
    """
    Special parser for CSAT Comprehension section.
    Extracts passages and attaches them to their question groups.
    
    Two formats in the PDF:
    1. "Directions for the following N items:" -> passage(s) -> questions (2024-2025)
    2. Standalone "Passage" or "Passage-N" markers -> text -> questions (2011-2023)
    
    Strategy: Work through the text linearly, detecting passage starts and question starts.
    Each passage belongs to the questions that follow it until the next passage.
    """
    questions = []
    
    # Join all lines and clean
    full_text = '\n'.join(lines)
    # Remove standalone page numbers and topic headers
    full_text = re.sub(r'\n\d{1,3}\n', '\n', full_text)
    full_text = re.sub(r'\nComprehension\n', '\n', full_text)
    # Remove "Directions..." lines and "Read the following..." instructions
    full_text = re.sub(r'Directions?\s+for\s+the\s+following\s+\d+\s*\([^)]*\)\s*items?:\s*', '', full_text)
    full_text = re.sub(r'Read the following.*?only\.?\s*', '', full_text, flags=re.DOTALL | re.IGNORECASE)
    full_text = re.sub(r'Your answers.*?only\.?\s*', '', full_text, flags=re.IGNORECASE)
    
    # Split the text into segments: alternating passages and question blocks
    # A "Passage" marker starts a new passage segment
    # A "N.\t" line starts a question
    
    # Strategy: find all passage markers and all question starts, then interleave
    # Passage markers: "Passage" or "Passage-1" or "Passage - 1" or "Passage I/II/III" on a line
    passage_pattern = re.compile(r'\n(Passage\s*-?\s*(?:\d|[IV]{1,4}|)\s*)\n', re.IGNORECASE)
    
    # Find all passage marker positions
    passage_positions = [(m.start(), m.end(), m.group(1).strip()) for m in passage_pattern.finditer(full_text)]
    
    # Find all question start positions: N.\t
    question_pattern = re.compile(r'\n(\d+)\.\t')
    question_positions = [(m.start(), m.end(), int(m.group(1))) for m in question_pattern.finditer(full_text)]
    
    if not passage_positions:
        # Fallback: no passage markers found, parse as regular questions
        q_lines = full_text.split('\n')
        return parse_questions_csat(q_lines)
    
    # Build passage groups: for each passage marker, collect text until next question
    # Then collect questions until next passage marker
    current_passage_text = ""
    current_passage_questions = []
    
    # Process passages sequentially
    all_groups = []  # List of (passage_text, [question_indices])
    
    for p_idx, (p_start, p_end, p_label) in enumerate(passage_positions):
        # Find where this passage text ends (at the next question start after it)
        # OR at the next passage marker if there's a multi-passage group
        
        # Next passage marker position (if any)
        next_passage_start = passage_positions[p_idx + 1][0] if p_idx + 1 < len(passage_positions) else len(full_text)
        
        # Find the first question that comes after this passage
        first_q_after = None
        for q_start, q_end, q_num in question_positions:
            if q_start > p_start:
                first_q_after = (q_start, q_end, q_num)
                break
        
        if first_q_after is None:
            continue
        
        # Passage text is between passage marker end and first question start
        passage_text = full_text[p_end:first_q_after[0]]
        
        # Check if next passage comes BEFORE the first question (multi-passage group)
        # In that case, this passage text extends to the next passage marker
        if next_passage_start < first_q_after[0]:
            # This passage is part of a multi-passage group — combine with next
            # We'll handle this by marking it and combining later
            passage_text = full_text[p_end:next_passage_start]
            all_groups.append((p_label, passage_text, None))  # No questions yet
            continue
        
        # Collect all questions between this passage and the next passage marker
        q_end_boundary = next_passage_start
        passage_questions_text = full_text[first_q_after[0]:q_end_boundary]
        
        # Clean passage text
        clean_passage = passage_text.strip()
        clean_passage = re.sub(r'\t+', ' ', clean_passage)
        clean_passage = re.sub(r'\n+', ' ', clean_passage)
        clean_passage = re.sub(r'\s+', ' ', clean_passage).strip()
        
        # Combine with any preceding passage texts that had no questions (multi-passage)
        combined_passage = ""
        # Check if previous groups have no questions (multi-passage continuation)
        while all_groups and all_groups[-1][2] is None:
            prev_label, prev_text, _ = all_groups.pop()
            prev_clean = re.sub(r'\t+', ' ', prev_text)
            prev_clean = re.sub(r'\n+', ' ', prev_clean)
            prev_clean = re.sub(r'\s+', ' ', prev_clean).strip()
            combined_passage += f"<b>{prev_label}</b><br>{prev_clean}<br><br>"
        
        combined_passage += f"<b>{p_label}</b><br>{clean_passage}" if combined_passage else clean_passage
        if combined_passage and not combined_passage.startswith("<b>"):
            combined_passage = f"<b>{p_label}</b><br>{clean_passage}"
        
        all_groups.append((p_label, combined_passage, passage_questions_text))
    
    # Now parse questions for each group
    for p_label, passage_text, q_text in all_groups:
        if q_text is None:
            continue
        
        q_lines = q_text.split('\n')
        block_questions = parse_questions_csat(q_lines)
        
        for q in block_questions:
            q['passage'] = passage_text
            questions.append(q)
    
    # Handle questions that appear BEFORE the first passage marker
    if passage_positions and question_positions:
        first_passage_start = passage_positions[0][0]
        pre_passage_qs = [(qs, qe, qn) for qs, qe, qn in question_positions if qs < first_passage_start]
        if pre_passage_qs:
            pre_text = full_text[:first_passage_start]
            pre_lines = pre_text.split('\n')
            pre_questions = parse_questions_csat(pre_lines)
            for q in pre_questions:
                q['passage'] = ''
            questions = pre_questions + questions
    
    return questions


def extract_gs1():
    """Extract all GS1 questions."""
    doc = fitz.open(GS1_PDF)
    all_pages_lines = []
    for i in range(doc.page_count):
        all_pages_lines.append(doc[i].get_text().split('\n'))
    
    print(f"GS1: Loaded {doc.page_count} pages")
    
    all_data = []
    total_q = 0
    total_a = 0
    
    for topic in GS1_TOPICS:
        topic_data = {"name": topic["name"], "subtopics": []}
        
        for subtopic in topic["subtopics"]:
            start_idx = subtopic["pages"][0] + 5  # GS1 offset
            end_idx = subtopic["pages"][1] + 5
            
            question_lines = []
            answer_lines = []
            
            for page_idx in range(start_idx, end_idx + 1):
                if page_idx >= len(all_pages_lines):
                    break
                page_lines = all_pages_lines[page_idx]
                page_text = '\n'.join(page_lines[:10])
                
                is_explanation = 'explanation' in page_text.lower() and any('Answer:' in l for l in page_lines[:20])
                
                if is_explanation:
                    answer_lines.extend(page_lines)
                else:
                    question_lines.extend(page_lines)
            
            questions = parse_questions_stateful_gs1(question_lines)
            answers, answer_years = parse_answers_gs1(answer_lines)
            
            # Deduplicate: if same Q number appears twice, keep the one with a year
            seen_nums = {}
            for q in questions:
                num = q["number"]
                if num in seen_nums:
                    existing = seen_nums[num]
                    # Keep the one with a year, or the one with longer text
                    if not existing["year"] and q["year"]:
                        seen_nums[num] = q
                    elif existing["year"] and not q["year"]:
                        pass  # keep existing
                    elif len(q["question"]) > len(existing["question"]):
                        seen_nums[num] = q
                else:
                    seen_nums[num] = q
            questions = list(seen_nums.values())
            
            # Remove fragment questions (no year + looks like tail-end of a question from previous page)
            def is_fragment(q):
                if q["year"]:
                    return False
                text = q["question"]
                # Fragments typically start with trailing phrases or mid-list items
                fragment_starts = [
                    r'^Select the correct answer',
                    r'^Which of the statements given above',
                    r'^Which of the above',
                    r'^How many of the above',
                    r'^An? \w+ phenomenon can',  # continuation sentence
                    r'^\d+\.\s+\w',  # starts with a numbered item > 1
                    r'^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z]',  # Proper nouns (list items)
                ]
                # Check if text starts like a fragment
                for pat in fragment_starts:
                    if re.match(pat, text):
                        return True
                # If it contains "Select the correct answer" but no "Consider"/"With reference" before it
                if 'Select the correct answer' in text and not any(
                    phrase in text[:50] for phrase in ['Consider', 'With reference', 'Which of the following', 'In the context']):
                    if len(text) < 200:  # Short fragments
                        return True
                return False
            
            questions = [q for q in questions if not is_fragment(q)]
            
            for q in questions:
                ans = answers.get(q["number"], "")
                if ans == 'x':
                    q["answer"] = "X"  # Dropped by UPSC
                else:
                    q["answer"] = ans
                # If question has no year, try to get it from answers page
                if not q["year"] and q["number"] in answer_years:
                    q["year"] = answer_years[q["number"]]
            
            subtopic_data = {"name": subtopic["name"], "questions": questions}
            topic_data["subtopics"].append(subtopic_data)
            
            answered = sum(1 for q in questions if q["answer"])
            total_q += len(questions)
            total_a += answered
            print(f"  {subtopic['name']}: {len(questions)} Q, {answered} A")
        
        all_data.append(topic_data)
    
    doc.close()
    print(f"\nGS1 Total: {total_q} questions, {total_a} answers")
    return all_data


def extract_csat():
    """Extract all CSAT questions."""
    doc = fitz.open(CSAT_PDF)
    all_pages_lines = []
    for i in range(doc.page_count):
        all_pages_lines.append(doc[i].get_text().split('\n'))
    
    print(f"\nCSAT: Loaded {doc.page_count} pages")
    
    all_data = []
    total_q = 0
    total_a = 0
    
    for topic in CSAT_TOPICS:
        topic_data = {"name": topic["name"], "subtopics": []}
        
        for subtopic in topic["subtopics"]:
            start_idx = subtopic["pages"][0] - 1  # CSAT offset: printed - 1
            end_idx = subtopic["pages"][1] - 1
            
            question_lines = []
            answer_lines = []
            
            for page_idx in range(start_idx, end_idx + 1):
                if page_idx >= len(all_pages_lines):
                    break
                page_lines = all_pages_lines[page_idx]
                page_text = '\n'.join(page_lines[:5])
                
                # CSAT explanation pages have "_Explanations" in header
                is_explanation = '_Explanation' in page_text or (
                    'Solution:' in '\n'.join(page_lines[:15]) and 
                    'Answer:' in '\n'.join(page_lines[:15])
                )
                
                if is_explanation:
                    answer_lines.extend(page_lines)
                else:
                    question_lines.extend(page_lines)
            
            # Use comprehension parser for Comprehension topic
            if topic["name"] == "Comprehension":
                questions = parse_comprehension_questions(question_lines)
            else:
                questions = parse_questions_csat(question_lines)
            answers = parse_answers_csat(answer_lines)
            
            for q in questions:
                ans = answers.get(q["number"], "")
                if ans == 'x':
                    q["answer"] = "X"
                else:
                    q["answer"] = ans
            
            subtopic_data = {"name": subtopic["name"], "questions": questions}
            topic_data["subtopics"].append(subtopic_data)
            
            answered = sum(1 for q in questions if q["answer"])
            total_q += len(questions)
            total_a += answered
            print(f"  {subtopic['name']}: {len(questions)} Q, {answered} A")
        
        all_data.append(topic_data)
    
    doc.close()
    print(f"\nCSAT Total: {total_q} questions, {total_a} answers")
    return all_data


def main():
    # Extract both papers
    gs1_data = extract_gs1()
    csat_data = extract_csat()
    
    # Save GS1
    js_path = r'C:\Users\nishantkumar04\OneDrive - Nagarro\Desktop\pyq_data.js'
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write('const pyqGS1Data = ')
        json.dump(gs1_data, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n\n')
        f.write('const pyqCSATData = ')
        json.dump(csat_data, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    
    print(f"\nSaved: {js_path}")
    print(f"File size: {len(open(js_path, encoding='utf-8').read())} bytes")


if __name__ == "__main__":
    main()
