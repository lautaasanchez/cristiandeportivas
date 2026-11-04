import { fmtFull } from './logic'

export const googleUrl = (team, fecha) =>
  `https://www.google.com/search?q=${encodeURIComponent(`${team} resultado ${fecha ? fmtFull(fecha) : ''}`.trim())}`

// La primera búsqueda abre una ventana aparte; las siguientes reutilizan esa misma ventana (no se abren más)
export const openResults = (url) => {
  const w = window.open(url, 'busqueda-resultados', 'popup=yes,width=1100,height=800')
  if (w) w.focus()
  else alert('El navegador bloqueó la ventana de búsqueda. Permití las ventanas emergentes para esta página.')
}
