# CMO Coagulopatías Congénitas

Repositorio para la futura herramienta de soporte a la decisión basada en la
**«Adaptación del Modelo de Atención Farmacéutica CMO al paciente con
coagulopatías congénitas»**.

## Estado del proyecto

La implementación clínica está **bloqueada de forma intencionada** hasta que el
documento clínico de referencia se incorpore al repositorio. En el estado actual
del entorno no se ha localizado dicho documento y el repositorio no contiene
código de una aplicación previa.

No se han transcrito variables, puntuaciones, reglas ni intervenciones desde el
resumen de requisitos: hacerlo convertiría una fuente secundaria e incompleta en
la fuente de verdad y podría introducir discrepancias clínicas.

## Fuente clínica requerida

Antes de desarrollar la aplicación, añada una copia autorizada del documento de
referencia (PDF o DOCX) en `docs/clinical-source/`. Si la licencia impide
versionarlo, facilite el archivo en el entorno de trabajo y documente su versión,
fecha y huella SHA-256.

La auditoría previa a la implementación se describe en
[`docs/CLINICAL_SOURCE_GATE.md`](docs/CLINICAL_SOURCE_GATE.md).

## Principios de seguridad acordados

- La fuente clínica primaria prevalece sobre el resumen funcional.
- Una ausencia de evidencia en la HCE nunca equivale a una respuesta negativa.
- Ninguna propuesta automatizada entra en el cálculo sin confirmación profesional.
- El producto no solicitará identificadores personales innecesarios; utilizará un
  identificador pseudonimizado.
- La aplicación deberá funcionar en modo manual y sin enviar información clínica
  a servicios externos.
- Las reglas clínicas, variables, intervenciones y periodicidades tendrán una sola
  fuente de verdad versionada y verificable mediante pruebas.

## Próximo paso

Incorporar o facilitar el documento clínico completo. Una vez disponible se podrá
cerrar la matriz de trazabilidad, escoger el stack mínimo compatible con GitHub
Pages e implementar la aplicación y sus pruebas sin hacer suposiciones clínicas.

