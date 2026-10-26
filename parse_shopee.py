import zipfile
import xml.etree.ElementTree as ET
import os

def read_shopee_excel(filename):
    print("\n-----------------------------------------")
    print("Reading:", filename)
    with zipfile.ZipFile(filename, 'r') as z:
        # Read shared strings
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
                t = si.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
                if t is not None and t.text is not None:
                    strings.append(t.text)
                else:
                    # check for r/t
                    texts = [elem.text for elem in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t') if elem.text]
                    strings.append("".join(texts))
        
        # Read sheet1.xml
        sheet_path = 'xl/worksheets/sheet1.xml'
        if sheet_path in z.namelist():
            tree = ET.fromstring(z.read(sheet_path))
            ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            rows = []
            for row_el in tree.findall('.//main:row', ns):
                row_data = {}
                for c_el in row_el.findall('main:c', ns):
                    r = c_el.get('r') # e.g. A1, B2
                    t = c_el.get('t') # s for shared string
                    v_el = c_el.find('main:v', ns)
                    val = ""
                    if v_el is not None and v_el.text is not None:
                        val = v_el.text
                        if t == 's':
                            idx = int(val)
                            if idx < len(strings):
                                val = strings[idx]
                    row_data[r] = val
                rows.append((row_el.get('r'), row_data))
            
            print(f"Total rows parsed: {len(rows)}")
            for r_num, r_data in rows[:15]:
                print(f"Row {r_num}:", {k: v for k, v in list(r_data.items())[:8]})

for f in [
    'mass_update_basic_info_381421545_20260911100357.xlsx',
    'mass_update_sales_info_381421545_20260911100617.xlsx',
    'mass_update_shipping_info_381421545_20260911100313.xlsx',
    'mass_update_media_info_381421545_20260911100714.xlsx'
]:
    if os.path.exists(f):
        read_shopee_excel(f)
