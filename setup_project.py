import os
import shutil

# Move products.json to the new project src folder
shutil.copy('D:\\Saif\\Shopee konsep\\products.json', 'D:\\Saif\\Shopee konsep\\web-app\\src\\products.json')

# Create config file
config_content = """export const config = {
  brandName: "Brand Anda",
  whatsappNumber: "6285695316096",
  primaryColor: "#000000",
  shippingApiKey: "b0ffff3c2299551401bdfcf35ea9be8283c0aab612cc0241c5d813e4f0f2a393"
};
"""
with open('D:\\Saif\\Shopee konsep\\web-app\\src\\config.ts', 'w') as f:
    f.write(config_content)
