import zipfile
import xml.etree.ElementTree as ET
import json
import os

def parse_excel(filename):
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
            rows = []
            for row_el in tree.findall('.//main:row', ns):
                row_data = {}
                for c_el in row_el.findall('main:c', ns):
                    r = c_el.get('r')
                    t = c_el.get('t')
                    v_el = c_el.find('main:v', ns)
                    val = ""
                    if v_el is not None and v_el.text is not None:
                        val = v_el.text
                        if t == 's':
                            idx = int(val)
                            if idx < len(strings):
                                val = strings[idx]
                    row_data[r] = val
                rows.append(row_data)
            return rows
    return []

# Helper to convert cell letter to index e.g. A->0, B->1, AA->26
def col_to_idx(col_str):
    res = 0
    for char in col_str:
        if 'A' <= char <= 'Z':
            res = res * 26 + (ord(char) - ord('A') + 1)
    return res - 1

def row_to_dict(row_data, header_row):
    d = {}
    for cell_ref, val in row_data.items():
        # separate letters and numbers
        letters = "".join([c for c in cell_ref if c.isalpha()])
        idx = col_to_idx(letters)
        if idx < len(header_row):
            h_name = header_row[idx]
            if h_name:
                d[h_name] = val
    return d

def get_header_and_data(rows, header_row_idx):
    if len(rows) <= header_row_idx:
        return [], []
    
    # Extract header names
    h_row = rows[header_row_idx]
    max_col = 0
    for k in h_row.keys():
        letters = "".join([c for c in k if c.isalpha()])
        idx = col_to_idx(letters)
        if idx > max_col:
            max_col = idx
            
    header_names = []
    for i in range(max_col + 1):
        # find cell ref for column i
        col_let = ""
        temp = i + 1
        while temp > 0:
            temp, remainder = divmod(temp - 1, 26)
            col_let = chr(65 + remainder) + col_let
        ref = col_let + str(header_row_idx + 1)
        header_names.append(h_row.get(ref, ''))
        
    data = []
    for r_idx in range(header_row_idx + 1, len(rows)):
        r_data = rows[r_idx]
        # check if row has data
        if not r_data:
            continue
        d = {}
        for cell_ref, val in r_data.items():
            letters = "".join([c for c in cell_ref if c.isalpha()])
            idx = col_to_idx(letters)
            if idx < len(header_names):
                h_name = header_names[idx]
                if h_name:
                    d[h_name] = val
        if any(d.values()):
            data.append(d)
            
    return header_names, data

basic_rows = parse_excel('mass_update_basic_info_381421545_20260911100357.xlsx')
sales_rows = parse_excel('mass_update_sales_info_381421545_20260911100617.xlsx')
media_rows = parse_excel('mass_update_media_info_381421545_20260911100714.xlsx')

_, basic_data = get_header_and_data(basic_rows, 2) # Row 3 is index 2
_, sales_data = get_header_and_data(sales_rows, 2) # Row 3 is index 2 (Wait, let's check sales row index. In sales_rows, row 3 is index 2 or 3? Let's verify)

print("Basic data count:", len(basic_data))
if basic_data:
    print("Sample basic:", basic_data[0])
