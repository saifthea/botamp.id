import zipfile
import xml.etree.ElementTree as ET
import json
import os
import re

def parse_excel_file(filename):
    if not os.path.exists(filename):
        print(f"File not found: {filename}")
        return []
    
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
            
            # Find row with header (containing 'Kode Produk')
            header_col_map = {}
            parsed_rows = []
            
            for row_el in rows:
                c_cells = row_el.findall('main:c', ns)
                row_data = {}
                for c in c_cells:
                    ref = c.get('r') # e.g. A3
                    col_let = "".join([char for char in ref if char.isalpha()])
                    t = c.get('t')
                    v_el = c.find('main:v', ns)
                    val = v_el.text if v_el is not None else ""
                    if t == 's' and val:
                        val = strings[int(val)]
                    row_data[col_let] = val.strip() if isinstance(val, str) else val
                
                # Check if this row is the header row
                if 'Kode Produk' in row_data.values():
                    # Map column letters to header names
                    for col_let, h_name in row_data.items():
                        if h_name:
                            header_col_map[col_let] = h_name
                    continue
                
                # If header has been mapped, process data rows
                if header_col_map:
                    # Map row_data to header names
                    named_row = {}
                    for col_let, val in row_data.items():
                        if col_let in header_col_map:
                            h_name = header_col_map[col_let]
                            named_row[h_name] = val
                            
                    # Check if valid product row
                    pid = named_row.get('Kode Produk', '')
                    if pid and pid.isdigit():
                        parsed_rows.append(named_row)
                        
            return parsed_rows
    return []

basic = parse_excel_file('mass_update_basic_info_381421545_20260911100357.xlsx')
sales = parse_excel_file('mass_update_sales_info_381421545_20260911100617.xlsx')
shipping = parse_excel_file('mass_update_shipping_info_381421545_20260911100313.xlsx')
media = parse_excel_file('mass_update_media_info_381421545_20260911100714.xlsx')

print(f"Basic items: {len(basic)}")
print(f"Sales rows: {len(sales)}")
print(f"Shipping rows: {len(shipping)}")
print(f"Media rows: {len(media)}")

# Build maps by product_id
basic_map = {item['Kode Produk']: item for item in basic}
media_map = {item['Kode Produk']: item for item in media}

sales_map = {}
for s in sales:
    pid = s['Kode Produk']
    if pid not in sales_map:
        sales_map[pid] = []
    sales_map[pid].append(s)

shipping_map = {}
for sh in shipping:
    pid = sh['Kode Produk']
    if pid not in shipping_map:
        shipping_map[pid] = []
    shipping_map[pid].append(sh)

products = []

for pid, b_item in basic_map.items():
    p_name = b_item.get('Nama Produk', '')
    p_desc = b_item.get('Deskripsi Produk', '')
    p_sku = b_item.get('SKU Induk', '')
    
    # Category and Images from media
    m_item = media_map.get(pid, {})
    raw_cat = m_item.get('Kategori', '')
    category = raw_cat.split('/')[-1].strip() if '/' in raw_cat else (raw_cat or 'Umum')
    category = re.sub(r'^\d+\s*-\s*', '', category)
    if not category:
        category = 'Lainnya'
        
    images = []
    cover_img = m_item.get('Foto Sampul', '')
    if cover_img:
        images.append(cover_img)
    for i in range(1, 9):
        img_key = f'Foto Produk {i}'
        img_url = m_item.get(img_key, '')
        if img_url and img_url not in images:
            images.append(img_url)
            
    # Variants from sales and shipping
    p_sales = sales_map.get(pid, [])
    p_shipping = shipping_map.get(pid, [])
    
    variants = []
    total_stock = 0
    prices = []
    
    for s_var in p_sales:
        v_id = s_var.get('Kode Variasi', '')
        v_name = s_var.get('Nama Variasi', '')
        v_sku = s_var.get('SKU', '')
        
        try:
            price = float(s_var.get('Harga', 0))
        except:
            price = 0
            
        try:
            stock = int(s_var.get('Stok', 0))
        except:
            stock = 0
            
        weight = 200 # default fallback 200g
        for sh_var in p_shipping:
            if sh_var.get('Kode Variasi') == v_id or (v_name and sh_var.get('Nama Variasi') == v_name):
                try:
                    w = float(sh_var.get('Berat Produk/g', 0))
                    if w > 0:
                        weight = w
                except:
                    pass
                break
                
        if price > 0:
            prices.append(price)
        total_stock += stock
        
        variants.append({
            "id": v_id or f"{pid}-{len(variants)+1}",
            "name": v_name or "Standard",
            "sku": v_sku,
            "price": price,
            "stock": stock,
            "weight": weight
        })
        
    main_price = min(prices) if prices else 0
    
    products.append({
        "id": pid,
        "name": p_name,
        "sku": p_sku,
        "description": p_desc,
        "category": category,
        "price": main_price,
        "stock": total_stock,
        "images": images,
        "variants": variants
    })

print(f"\nSuccessfully generated {len(products)} normalized products.")
if products:
    print("Sample product overview:")
    print(json.dumps(products[0], indent=2, ensure_ascii=False)[:500])

with open('products.json', 'w', encoding='utf-8') as f:
    json.dump(products, f, indent=2, ensure_ascii=False)
