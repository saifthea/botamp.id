import zipfile
import xml.etree.ElementTree as ET
import os

for f in [
    'mass_update_basic_info_381421545_20260911100357.xlsx',
    'mass_update_sales_info_381421545_20260911100617.xlsx',
    'mass_update_shipping_info_381421545_20260911100313.xlsx',
    'mass_update_media_info_381421545_20260911100714.xlsx'
]:
    if os.path.exists(f):
        print("=== ZIP:", f)
        try:
            with zipfile.ZipFile(f, 'r') as z:
                for name in z.namelist():
                    print("  ", name)
        except Exception as e:
            print("  Error:", e)
