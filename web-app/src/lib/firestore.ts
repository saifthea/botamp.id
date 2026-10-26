// d:\Saif\Shopee konsep\web-app\src\lib\firestore.ts
// File ini hanya berisi type definitions untuk backward compatibility.
// Semua implementasi database sudah dipindahkan ke API routes (/api/products/*).

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  weight: number;
}

export interface Product {
  id: string;
  id_products?: string;
  name: string;
  sku: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  images: string[];
  variants: ProductVariant[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockUpdateItem {
  productId: string;
  variantId?: string;
  quantity: number;
}