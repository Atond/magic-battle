// Codec texte ⇄ base64 du domaine — T-10, support d'EXG-24 (« export en une chaîne texte encodée
// base64 et son import inverse »).
//
// Pourquoi un codec écrit ici plutôt qu'un appel à la plateforme :
//  1. les textes du jeu sont en français et contiennent des accents (et le joueur verra un jour des
//     emojis) ; les helpers historiques de la plateforme cliente échouent dès le premier caractère
//     hors Latin-1 ;
//  2. l'équivalent côté serveur (`Buffer`) n'existe pas côté client, et ce module doit donner le
//     **même octet** dans les deux mondes — les tests du moteur tournent hors navigateur ;
//  3. `src/domain/` n'a le droit d'accéder ni au navigateur ni au stockage (spec §9) : seuls
//     `TextEncoder`/`TextDecoder`, standards des deux côtés, sont utilisés.
//
// Aucune valeur de jeu ici : l'alphabet et le caractère de remplissage sont ceux de la RFC 4648 §4.

/** RFC 4648 §4 — alphabet base64 standard (et non `base64url` : l'export est destiné à un champ texte). */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const REMPLISSAGE = '='

/** Table inverse de l'alphabet, indexée par code de caractère ASCII ; `-1` = caractère refusé. */
const VALEURS = (() => {
  const table = new Int8Array(128).fill(-1)
  for (let i = 0; i < ALPHABET.length; i += 1) table[ALPHABET.charCodeAt(i)] = i
  return table
})()

/** Plus grand code de caractère que la table inverse sait adresser (ASCII 7 bits). */
const CODE_MAX = 127

const ENCODEUR = new TextEncoder()
/** `fatal: true` — une séquence d'octets qui n'est pas de l'UTF-8 valide lève au lieu de produire « � ». */
const DECODEUR = new TextDecoder('utf-8', { fatal: true })

/** UTF-8 → octets. Passe les accents et les caractères hors BMP sans perte. */
export function encoderUtf8(texte: string): Uint8Array {
  return ENCODEUR.encode(texte)
}

/** Octets → UTF-8, ou `null` si les octets ne forment pas de l'UTF-8 valide (entrée non fiable). */
export function decoderUtf8(octets: Uint8Array): string | null {
  try {
    return DECODEUR.decode(octets)
  } catch {
    return null
  }
}

/** RFC 4648 §4 — octets → base64, par groupes de 3 octets (4 caractères), remplissage compris. */
export function encoderBase64(octets: Uint8Array): string {
  const morceaux: string[] = []
  for (let i = 0; i < octets.length; i += 3) {
    const restants = octets.length - i
    const o0 = octets[i]
    const o1 = restants > 1 ? octets[i + 1] : 0
    const o2 = restants > 2 ? octets[i + 2] : 0
    morceaux.push(
      ALPHABET[o0 >> 2] +
        ALPHABET[((o0 & 0x03) << 4) | (o1 >> 4)] +
        (restants > 1 ? ALPHABET[((o1 & 0x0f) << 2) | (o2 >> 6)] : REMPLISSAGE) +
        (restants > 2 ? ALPHABET[o2 & 0x3f] : REMPLISSAGE),
    )
  }
  return morceaux.join('')
}

/**
 * RFC 4648 §4 — base64 → octets, ou `null` sur toute entrée qui n'est pas du base64 canonique :
 * longueur non multiple de 4, caractère hors alphabet, remplissage mal placé, bits de bourrage non
 * nuls. Les espaces et retours à la ligne d'un copier-coller sont retirés avant analyse (ils ne font
 * pas partie de l'alphabet, donc leur suppression n'introduit aucune ambiguïté).
 * Une entrée invalide est une **valeur de retour**, jamais une exception : l'appelant en fait un motif
 * d'erreur affichable (EXG-27, EXG-45).
 */
export function decoderBase64(texte: string): Uint8Array | null {
  if (typeof texte !== 'string') return null
  const compact = texte.replace(/\s+/g, '')
  if (compact.length === 0) return new Uint8Array(0)
  if (compact.length % 4 !== 0) return null

  let remplissage = 0
  if (compact.endsWith(REMPLISSAGE + REMPLISSAGE)) remplissage = 2
  else if (compact.endsWith(REMPLISSAGE)) remplissage = 1

  const utile = compact.length - remplissage
  const octets = new Uint8Array((compact.length / 4) * 3 - remplissage)
  let sortie = 0
  let accumulateur = 0
  let bits = 0

  for (let i = 0; i < utile; i += 1) {
    const code = compact.charCodeAt(i)
    if (code > CODE_MAX) return null
    const valeur = VALEURS[code]
    if (valeur < 0) return null
    accumulateur = (accumulateur << 6) | valeur
    bits += 6
    if (bits >= 8) {
      bits -= 8
      octets[sortie] = (accumulateur >> bits) & 0xff
      sortie += 1
    }
  }

  // Remplissage canonique : les bits qui n'entrent dans aucun octet complet doivent être nuls.
  if (bits > 0 && (accumulateur & ((1 << bits) - 1)) !== 0) return null
  return sortie === octets.length ? octets : null
}

/** Texte → base64 (UTF-8 en interne) : l'aller de l'export d'EXG-24. */
export function texteVersBase64(texte: string): string {
  return encoderBase64(encoderUtf8(texte))
}

/** Base64 → texte, ou `null` si le base64 ou l'UTF-8 sous-jacent est invalide : le retour d'EXG-24. */
export function base64VersTexte(texte: string): string | null {
  const octets = decoderBase64(texte)
  return octets === null ? null : decoderUtf8(octets)
}
