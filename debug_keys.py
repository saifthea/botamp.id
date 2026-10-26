import zipfile
import xml.etree.ElementTree as ET

def check_keys_and_values(filename):
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
            
            # Row 3 (header) is index 2
            h_row = rows[2]
            h_vals = {}
            for c in h_row.findall('main:c', ns):
                ref = c.get('r')
                t = c.get('t')
                v_el = c.find('main:v', ns)
                v_text = v_el.text if v_el is not None else ""
                if t == 's' and v_text:
                    v_text = strings[int(v_text)]
                h_vals[ref] = v_text
            print("Row 3 values:", h_vals)
            
            # Row 7 is index 6
            row_7 = rows[6]
            r7_vals = {}
            for c in row_7.findall('main:c', ns):
                ref = c.get('r')
                t = c.get('t')
                v_el = c.find('main:v', ns)
                v_text = v_el.text if v_el is not None else ""
                if t == 's' and v_text:
                    v_text = strings[int(v_text)]
                r7_vals[ref] = v_text
            print("Row 7 values:", r7_vals)

check_keys_and_values('mass_update_basic_info_381421545_20260911100357.xlsx')
