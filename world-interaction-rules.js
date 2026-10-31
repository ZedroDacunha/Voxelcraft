// Regras de prioridade do clique direito no mundo.
//
// Antes, comer só funcionava mirando no ar (`food && !currentHit`), o que
// obrigava o jogador a "olhar para o céu" para se alimentar. A ordem abaixo é a
// mesma das interações de bloco já existentes, com a comida valendo também
// quando há um bloco na mira:
//
//   bancada/forno/baú > porta > comer > colocar bloco
//
// Agachar (shift ou a tecla de agachar) ignora baú/forno/bancada/porta e deixa
// a ação ir para o item da mão, como no gênero.
export function rightClickIntent({ sneaking = false, station = false, door = false, food = false } = {}) {
    if (!sneaking && station) return 'station';
    if (!sneaking && door) return 'door';
    if (food) return 'eat';
    return 'place';
}
