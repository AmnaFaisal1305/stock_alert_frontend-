const VACCINE_NAME_MAP = {
  'Vaccine 01': 'بی سی جی',
  'Vaccine 02': 'او پی وی (پولیو)',
  'Vaccine 03': 'روٹا',
  'Vaccine 04': 'آئی پی وی',
  'Vaccine 05': 'نیموکوکل',
  'Vaccine 06': 'پینٹاویلینٹ - ڈی',
  'Vaccine 07': 'پینٹاویلینٹ - ٹی',
  'Vaccine 08': 'پینٹاویلینٹ - پی',
  'Vaccine 09': 'پینٹاویلینٹ - بیپ بی',
  'Vaccine 10': 'پینٹاویلینٹ - بب',
  'Vaccine 11': 'ایم آر خسرہ',
  'Vaccine 12': 'ایم آر روبیلا',
  'Vaccine 13': 'ٹی سی وی',
}

export function displayVaccineName(name) {
  if (!name) return name
  return VACCINE_NAME_MAP[name] ?? name
}
