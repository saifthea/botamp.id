import zipfile
import xml.etree.ElementTree as ET
import os

def check_first_few_rows(filename):
    print("=== File:", filename)
    with zipfile.ZipFile(filename, 'r') as z:
        sheet_path = 'xl/worksheets/sheet1.xml'
        if sheet_path in z.namelist():
            tree = ET.fromstring(z.read(sheet_path))
            ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            rows = tree.findall('.//main:row', ns)
            print("Total rows elements in sheet1:", len(rows))
            for row_el in rows[:15]:
                r_num = row_el.get('r')
                cells = row_el.findall('main:c', ns)
                print(f"Row {r_num} has {len(cells)} cells. Keys/Values:", [c.get('r') for c in cells[:5]])

check_first_few_rows('mass_update_basic_info_381421545_20260911100357.xlsx')
