// Tipos de jugada (mercados). Es solo una anotación de la jugada: se muestra en la tabla y se exporta al Excel.
export const MARKETS = [
  { id: '', label: 'Sin definir' },
  { id: 'GANADOR', label: 'Ganador / 1X2' },
  { id: 'EMPATE', label: 'Empate' },
  { id: 'EMPATE_NO_VALE', label: 'Empate no válido' },
  { id: 'HANDICAP_0', label: 'Hándicap 0.0' },
  { id: 'MAS_0_5', label: 'Más de 0.5' },
  { id: 'MAS_1_5', label: 'Más de 1.5' },
  { id: 'MAS_2_5', label: 'Más de 2.5' },
  { id: 'MAS_3_5', label: 'Más de 3.5' },
  { id: 'MENOS_1_5', label: 'Menos de 1.5' },
  { id: 'MENOS_2_5', label: 'Menos de 2.5' },
  { id: 'MENOS_3_5', label: 'Menos de 3.5' },
  { id: 'AMBOS', label: 'Ambos anotan' },
]
export const marketLabel = (id) => MARKETS.find((m) => m.id === id)?.label || ''
