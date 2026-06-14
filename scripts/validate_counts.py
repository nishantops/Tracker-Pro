"""
Validate year-wise question counts for GS1 (expected: 100/year) and CSAT (expected: 80/year).
Also check the PDFs directly to see if they contain the expected number per year.
"""
import json
import fitz
import re
from collections import Counter

GS1_PDF = r'C:\Users\nishantkumar04\Downloads\Previous-Papers-Prelims-GS-Topicwise-English-1.pdf'
CSAT_PDF = r'C:\Users\nishantkumar04\Downloads\Topicwise-CSAT-PYQs-2011-2025-1.pdf'

# Load extracted data
with open(r'C:\Users\nishantkumar04\OneDrive - Nagarro\Desktop\pyq_data.js', 'r', encoding='utf-8') as f:
    c = f.read()

gs1_start = c.find('const pyqGS1Data = ') + len('const pyqGS1Data = ')
gs1_end = c.find(';\n\nconst pyqCSATData')
csat_start = c.find('const pyqCSATData = ') + len('const pyqCSATData = ')
csat_end = c.rfind(';\n')

gs1 = json.loads(c[gs1_start:gs1_end])
csat = json.loads(c[csat_start:csat_end])

# Count by year in extracted data
print("=" * 60)
print("GS1 - Year-wise counts (expected: 100/year, 2013-2025)")
print("=" * 60)
gs1_year_count = Counter()
gs1_no_year = 0
for t in gs1:
    for s in t['subtopics']:
        for q in s['questions']:
            if q['year']:
                gs1_year_count[q['year']] += 1
            else:
                gs1_no_year += 1

for year in sorted(gs1_year_count.keys(), reverse=True):
    expected = 100
    actual = gs1_year_count[year]
    status = "OK" if actual == expected else f"MISSING {expected - actual}"
    print(f"  {year}: {actual:3d} / {expected}  {status}")
print(f"  No year: {gs1_no_year}")
print(f"  TOTAL: {sum(gs1_year_count.values()) + gs1_no_year}")

print("\n" + "=" * 60)
print("CSAT - Year-wise counts (expected: 80/year, 2011-2025)")
print("=" * 60)
csat_year_count = Counter()
csat_no_year = 0
for t in csat:
    for s in t['subtopics']:
        for q in s['questions']:
            if q['year']:
                csat_year_count[q['year']] += 1
            else:
                csat_no_year += 1

for year in sorted(csat_year_count.keys(), reverse=True):
    expected = 80
    actual = csat_year_count[year]
    status = "OK" if actual == expected else f"MISSING {expected - actual}"
    print(f"  {year}: {actual:3d} / {expected}  {status}")
print(f"  No year: {csat_no_year}")
print(f"  TOTAL: {sum(csat_year_count.values()) + csat_no_year}")

# Now check the PDFs directly - count year markers
print("\n" + "=" * 60)
print("GS1 PDF - Year markers found directly")
print("=" * 60)
doc = fitz.open(GS1_PDF)
pdf_gs1_years = Counter()
for i in range(doc.page_count):
    text = doc[i].get_text()
    # Year markers: (2025), (2024), etc
    years = re.findall(r'\(20[12]\d\)', text)
    for y in years:
        pdf_gs1_years[y.strip('()')] += 1
doc.close()

for year in sorted(pdf_gs1_years.keys(), reverse=True):
    print(f"  {year}: {pdf_gs1_years[year]:3d} occurrences in PDF")

print("\n" + "=" * 60)
print("CSAT PDF - Year markers found directly")
print("=" * 60)
doc = fitz.open(CSAT_PDF)
pdf_csat_years = Counter()
for i in range(doc.page_count):
    text = doc[i].get_text()
    years = re.findall(r'\(CSAT-(\d{4})\)', text)
    for y in years:
        pdf_csat_years[y] += 1
doc.close()

for year in sorted(pdf_csat_years.keys(), reverse=True):
    print(f"  {year}: {pdf_csat_years[year]:3d} occurrences in PDF")
