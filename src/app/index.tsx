import { Redirect } from 'expo-router';

/** La raiz es Mi ruta (mapa del repartidor), como en el diseño. */
export default function Index() {
  return <Redirect href="/mapa" />;
}
