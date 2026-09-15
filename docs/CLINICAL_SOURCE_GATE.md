# Puerta de seguridad de la fuente clínica

## Motivo

La herramienta solicitada es un sistema de soporte a la decisión clínica. Su
implementación no debe comenzar a partir de una lista parcial de ejemplos: debe
partir de la revisión completa de la publicación **«Adaptación del Modelo de
Atención Farmacéutica CMO al paciente con coagulopatías congénitas»**.

Durante la inspección inicial del 15 de septiembre de 2026:

- el repositorio contenía únicamente el commit de inicialización y `.gitkeep`;
- no había archivos PDF, DOCX u ODT clínicos bajo `/workspace`;
- las referencias web indicadas no pudieron consultarse desde el entorno por una
  restricción de acceso de red (HTTP 401/403).

Por seguridad, no se ha creado lógica clínica a partir de los ejemplos del
encargo ni se han completado las lagunas mediante supuestos.

## Material necesario

1. Documento completo y legible, incluida cualquier tabla, figura, anexo y nota
   al pie.
2. Edición o versión, fecha de publicación y, si existe, DOI.
3. Confirmación de si hay fe de erratas o material suplementario aplicable.
4. Permiso para conservar el documento en Git o, en su defecto, una ubicación
   accesible durante el desarrollo.

## Auditoría obligatoria antes de codificar

La revisión debe producir una matriz trazable con **exactamente 23 variables** y
las siguientes columnas:

| Campo | Contenido requerido |
| --- | --- |
| Identificador estable | Clave técnica única y no dependiente del texto visible |
| Dimensión | Demográfica, clínica, farmacoterapéutica o sociosanitaria |
| Texto documental | Denominación fiel y referencia de página/tabla |
| Opciones | Todas las respuestas permitidas, incluido «no aplicable» solo si consta |
| Puntuación | Valor exacto de cada opción |
| Obligatoriedad | Regla documental para considerar completa la evaluación |
| Procedencia | HCE, entrevista o ambas, según el documento |
| Regla especial | Excepción, dependencia o ámbito de aplicación |
| Implementación | Ruta del dato y función pura que lo consume |
| Prueba | Caso automático que verifica la transcripción |

Además, se deben transcribir y referenciar:

- los puntos de corte y todas las excepciones;
- las intervenciones de cada prioridad, conservando su composición acumulativa;
- la periodicidad y todos los motivos de reevaluación;
- los instrumentos o definiciones clínicas citados;
- cualquier ambigüedad, sin resolverla por inferencia.

## Criterio de salida de esta puerta

La implementación solo puede comenzar cuando:

- el documento haya sido revisado íntegramente;
- la matriz tenga 23 variables, sin faltantes ni duplicados;
- cada opción, puntuación, regla e intervención tenga una referencia documental;
- las ambigüedades estén registradas para validación por el responsable clínico;
- un segundo control confirme la transcripción antes de utilizarla como
  configuración centralizada.

## Comprobaciones posteriores previstas

Tras superar la puerta, las pruebas deberán cubrir como mínimo límites 19/20 y
27/28, terapia avanzada, exclusión pediátrica, ausencia de evidencia en HCE,
validación de importaciones, reinicio sin datos residuales y correspondencia
exacta entre estado activo, puntuación e informe.
