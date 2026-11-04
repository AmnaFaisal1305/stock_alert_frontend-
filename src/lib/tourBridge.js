// Thin bridge so AuthContext can call stopTour() without statically importing driver.js.
// tour.js registers its stopTour once the lazy chunk loads.
let _stop = null
export const registerStop = (fn) => { _stop = fn }
export const stopTour = () => { _stop?.() }
