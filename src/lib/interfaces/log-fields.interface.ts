/**
 * Contexte attaché à une ligne de log. Valeurs volontairement restreintes
 * aux primitives : un log doit rester sérialisable sans surprise, et une
 * structure profonde y serait le signe qu'on cherche à tracer autre chose
 * qu'un événement.
 */
export interface LogFields {
  readonly [key: string]: string | number | boolean | null | undefined;
}
