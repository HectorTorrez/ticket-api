/** Mensajes de validación en español para class-validator */
export const V = {
  email: 'El correo electrónico debe ser válido',
  string: 'Debe ser una cadena de texto',
  minLength: (n: number) => `Debe tener al menos ${n} caracteres`,
  maxLength: (n: number) => `Debe tener como máximo ${n} caracteres`,
  dateString: 'Debe ser una fecha ISO 8601 válida',
  int: 'Debe ser un número entero',
  min: (n: number) => `No debe ser menor que ${n}`,
  max: (n: number) => `No debe ser mayor que ${n}`,
  uuid: 'Debe ser un UUID válido',
  array: 'Debe ser un arreglo',
  arrayMinSize: (n: number) => `Debe contener al menos ${n} elemento(s)`,
  enum: 'Debe ser uno de los valores permitidos',
  boolean: 'Debe ser un valor booleano',
} as const;
