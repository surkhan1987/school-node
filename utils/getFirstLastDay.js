module.exports = (date, t = false) => {
  date = new Date(date)
  if (t) return {
    firstDay: new Date(date.getFullYear(), date.getMonth(), 1),
    lastDay: new Date(date.getFullYear(), date.getMonth() + 1, 1),
  }

  let firstMonday = new Date(date.getFullYear(), date.getMonth(), 1)
  firstMonday.setDate(firstMonday.getDate() + ((8 - firstMonday.getDay()) % 7))

  let lastSunday = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  lastSunday.setDate(lastSunday.getDate() + ((7 - lastSunday.getDay()) % 7))

  return {
    firstMonday,
    lastSunday,
  }
}
