export interface PesananItem {
  productName?: string;
  name?: string;
  variantName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Pesanan {
  id?: string;
  orderId: string;
  customerId?: string;
  customerPhone?: string;
  customerName: string;
  customerPhoneDisplay?: string;
  address: string;
  city: string;
  postal_code?: string;
  items: PesananItem[];
  subtotal: number;
  shippingCost: number;
  courier?: string;
  service?: string;
  service_type?: "instant" | "reguler";
  total: number;
  status?: string;
  paymentStatus?: "non_paid" | "paid" | "dibatalkan";
  waybillNumber?: string;
  canceledAt?: string;
  createdAt: any;
  customerMarkedDone?: boolean;
  hasComplaint?: boolean;
  komplainSelesai?: boolean;
}