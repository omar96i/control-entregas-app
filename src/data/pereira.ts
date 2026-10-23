import type { Customer, Order } from '../lib/types';

export const CUSTOMERS: Customer[] = [
  { id: 1, nombre: 'Carlos', apellidos: 'Hincapié', telefono: '3001112233', direccion_1: 'Cra 7 #19-28, Plaza de Bolívar', direccion_2: 'Ed. Bolívar, Apto 402', lat: 4.81321, lng: -75.69615 },
  { id: 2, nombre: 'María', apellidos: 'Restrepo', telefono: '3002223344', direccion_1: 'Av. 30 de Agosto #40-80, Cuba', lat: 4.8048, lng: -75.721 },
  { id: 3, nombre: 'Juan Pablo', apellidos: 'Osorio', telefono: '3003334455', direccion_1: 'Cll 14 #23-15, Circunvalar', lat: 4.8147, lng: -75.689 },
  { id: 4, nombre: 'Laura', apellidos: 'Castaño', telefono: '3004445566', direccion_1: 'Cra 10 #50-20, Megamall', lat: 4.8075, lng: -75.6866 },
  { id: 5, nombre: 'Diego', apellidos: 'Marín', telefono: '3005556677', direccion_1: 'UTP, La Julita, Bloque Y', lat: 4.7939, lng: -75.6877 },
  { id: 6, nombre: 'Sofía', apellidos: 'Valencia', telefono: '3006667788', direccion_1: 'Av. 30 de Agosto #96-82, Matecaña', lat: 4.8126, lng: -75.7395 },
  { id: 7, nombre: 'Andrés', apellidos: 'Echeverri', telefono: '3007778899', direccion_1: 'Vía Cerritos, Cond. Ukumarí Cs 22', lat: 4.758, lng: -75.749 },
  { id: 8, nombre: 'Camila', apellidos: 'Torres', telefono: '3008889900', direccion_1: 'Villasantana, Mz 12 Cs 8', lat: 4.825, lng: -75.705 },
  { id: 9, nombre: 'Felipe', apellidos: 'Giraldo', telefono: '3009990011', direccion_1: 'Dosquebradas, El Progreso Cra 16 #42-10', lat: 4.834, lng: -75.68 },
  { id: 10, nombre: 'Valentina', apellidos: 'Ríos', telefono: '3010001122', direccion_1: 'La Florida, Vía Armenia Km 3', lat: 4.774, lng: -75.673 },
];

const o = (
  id: number, code: string, customer_id: number, items: Order['items'],
  estado: string, prioridad: number, ventana?: string, notas?: string,
): Order => {
  const c = CUSTOMERS.find((x) => x.id === customer_id)!;
  return {
    id, code, customer_id, customer: c, items,
    total: items.reduce((a, i) => a + i.qty * i.precio, 0),
    estado, prioridad, lat: c.lat, lng: c.lng, address_snapshot: c.direccion_1,
    ventana_entrega: ventana, notas,
  };
};

/** Cola demo por prioridad 1,2,3,4… (círculos). Sin rutas. */
export const ORDERS: Order[] = [
  o(3, 'PED-0003', 3, [{ nombre: 'Pizza familiar hawaiana', qty: 1, precio: 52000 }], 'en_ruta', 1, '12:30-13:30'),
  o(1, 'PED-0001', 1, [{ nombre: 'Bandeja paisa', qty: 1, precio: 28000 }, { nombre: 'Jugo de lulo', qty: 2, precio: 6000 }], 'en_ruta', 2, '12:00-13:00', 'Sin cebolla'),
  o(5, 'PED-0005', 5, [{ nombre: 'Sushi x20', qty: 1, precio: 45000 }, { nombre: 'Gaseosa 1.5L', qty: 1, precio: 8000 }], 'en_ruta', 3, '13:00-14:00', 'Palillos extra'),
  o(2, 'PED-0002', 2, [{ nombre: 'Empanadas x10', qty: 1, precio: 18000 }, { nombre: 'Ají', qty: 1, precio: 2000 }], 'asignado', 4, '13:00-14:00'),
  o(6, 'PED-0006', 6, [{ nombre: 'Pollo asado entero', qty: 1, precio: 38000 }, { nombre: 'Arepas x4', qty: 1, precio: 6000 }], 'asignado', 5, '18:00-19:00'),
  o(4, 'PED-0004', 4, [{ nombre: 'Hamburguesa doble', qty: 2, precio: 24000 }, { nombre: 'Papas grandes', qty: 1, precio: 12000 }], 'asignado', 6, '19:00-20:00'),
  o(7, 'PED-0007', 7, [{ nombre: 'Picada para 4', qty: 1, precio: 65000 }], 'pendiente', 7, '20:00-21:00'),
  o(8, 'PED-0008', 9, [{ nombre: 'Desayuno montañero', qty: 2, precio: 15000 }], 'entregado', 0, '08:00-09:00'),
];
