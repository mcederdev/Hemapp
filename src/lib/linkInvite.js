// Delad vårdnad: tolka svaret från check_link_invite innan något skapas.
// Returnerar { error } om koden inte fungerar, { warning } om barnet redan delas med ett annat hem, annars {}.
export function linkInviteVerdict(check) {
  if (!check) return {}
  if (check.ok === false) return { error: check.error || 'Koden fungerar inte' }
  const homes = Array.isArray(check.already_linked) ? check.already_linked.filter(Boolean) : []
  if (homes.length === 0) return {}
  const kid = check.children || 'Barnet'
  const names = homes.map((n) => n.trim()).join(' och ')
  return {
    warning: `${kid} delas redan med ${names}.\n\nBor du där? Tryck Avbryt, välj "Gå med i min familj" och be någon i ${names} om familjens inbjudningskod (Familj → Bjud in).\n\nTryck OK bara om du har ett helt eget hem till.`,
  }
}

// Saknas funktionen i databasen (migreringen har inte körts än) ska appen fungera som förut
export function isMissingFunction(error) {
  return !!error && (error.code === 'PGRST202' || error.code === '42883')
}
