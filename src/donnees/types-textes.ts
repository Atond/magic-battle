// Forme commune des textes de contenu de la vague 3 (T-24 à T-27). Du texte écrit, jamais une sortie du
// simulateur : aucun nombre ici, l'UI affiche les valeurs chiffrées à côté, depuis `CONSTANTES`.

/** Texte affiché d'un élément de contenu : un nom court et une ligne. Du texte seulement, jamais un nombre. */
export interface TexteContenu {
  readonly nom: string
  readonly description: string
}
