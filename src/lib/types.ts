export type Customer = {
  id: number;
  nombre: string;
  apellidos?: string | null;
  telefono: string;
  direccion_1: string;
  direccion_2?: string | null;
  lat?: number | null;
  lng?: number | null;
  notas?: string | null;
};

export type OrderItem = { product_id?: number; nombre: string; qty: number; precio: number };

export type Order = {
  id: number;
  code: string;
  customer_id: number;
  customer?: Customer;
  customer_address_id?: number | null;
  zona_id?: number | null;
  zona?: { id: number; nombre: string } | null;
  repartidor_id?: number | null;
  items: OrderItem[];
  total: number;
  estado: string;
  /** 1 = principal, 2,3,4… 0 = sin priorizar / entregado */
  prioridad: number;
  lat?: number | null;
  lng?: number | null;
  address_snapshot?: string | null;
  ventana_entrega?: string | null;
  notas?: string | null;
  metodo_pago_esperado?: string | null;
  metodo_pago_final?: string | null;
  motivo_estado?: string | null;
  fecha_programada?: string | null;
  visto_en?: string | null;
  /** Trazo de firma (data-uri svg o puntos serializados). Obligatoria al completar. */
  firma?: string | null;
  firmado_por?: string | null;
  entregado_en?: string | null;
  /** Hora en que el conductor tocó «Voy a este pedido». */
  en_ruta_en?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type Jornada = {
  id: number;
  fecha: string;
  inicio_en?: string | null;
  fin_en?: string | null;
  estado: string;
  total_efectivo: number;
  total_transferencia: number;
  total_pedidos: number;
};

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  telefono?: string | null;
  zona_id?: number | null;
  zona?: { id: number; nombre: string } | null;
};
