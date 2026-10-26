import zipfile
import xml.etree.ElementTree as ET
import json
import os

def parse_full_excel(filename):
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

basic_rows = parse_full_excel('mass_update_basic_info_381421545_20260911100357.xlsx')
sales_rows = parse_full_excel('mass_update_sales_info_381421545_20260911100617.xlsx')
shipping_rows = parse_full_excel('mass_update_shipping_info_381421545_20260911100313.xlsx')
media_rows = parse_full_excel('mass_update_media_info_381421545_20260911100714.xlsx')

print(f"Basic rows: {len(basic_rows)}")
print(f"Sales rows: {len(sales_rows)}")
print(f"Shipping rows: {len(shipping_rows)}")
print(f"Media rows: {len(media_rows)}")

# Let's inspect headers for basic_rows
# Usually row 3 or 4 has column names, let's print row 3, 4, 5
for idx in [2, 3, 4, 5]:
    if idx < len(basic_rows):
        print(f"Basic Row {idx+1}:", basic_rows[idx])

for idx in [2, 3, 4, 5]:
    if idx < len(media_rows):
        print(f"Media Row {idx+1}:", media_rows[idx])

for idx in [2, 3, 4, 5]:
    if idx < len(sales_rows):
        print(f"Sales Row {idx+1}:", sales_rows[idx])
