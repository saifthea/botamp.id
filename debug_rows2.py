import zipfile
import xml.etree.ElementTree as ET
import os

def check_strings_and_row_vals(filename):
    print("=== File:", filename)
    with zipfile.ZipFile(filename, 'r') as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
                texts = [elem.text for elem in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t') if elem.text]
                strings.append("".join(texts))
        
        sheet_path = 'xl/worksheets/sheet1.xml'
        if sheet_path in z.namelist():
            tree = ET.fromstring(z.read(sheet_path))
            ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            rows = tree.findall('.//main:row', ns)
            print("Total rows elements in sheet1:", len(rows))
            for i in range(15):
                row_el = rows[i]
                r_num = row_el.get('r')
                cells = row_el.findall('main:c', ns)
                row_vals = {}
                for c in cells:
                    ref = c.get('r')
                    t = c.get('t')
                    v_el = c.find('main:v', ns)
                    v_text = v_el.text if v_el is not None else ""
                    if t == 's' and v_text:
                        v_text = strings[int(v_text)]
                    row_vals[ref] = v_text
                print(f"Row {r_num}:", row_vals)

check_strings_and_row_vals('mass_update_basic_info_381421545_20260911100357.xlsx')
